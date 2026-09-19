import { createHash, randomUUID } from 'node:crypto';

import { selectionNot } from '@ontahi/core/data-graph';
import { createPostgresDataGraphStorage } from '@ontahi/postgres/data-graph';
import { Effect } from 'effect';
import type { Pool } from 'pg';

import {
  buildAtlasOntahiDataset,
  createAtlasOntahiApplicationWithStorage,
  type AtlasMergedPullRequestInput,
  type AtlasCapabilities,
  type AtlasReconciliationRequest,
  type AtlasReconciliationResult,
} from '../domain/atlas-application';
import {
  parseAtlasPullRequestDirectives,
  type AtlasObservedPullRequest,
} from '../github/pull-request-evidence';
import { parseAtlasSourceRecords } from '../markdown/build-snapshot';
import { proposePlanLink } from '../domain/plan-link-proposal';
import {
  parseAtlasSessionDirective,
  resolveExecutionStreamActivityTarget,
  resolveExecutionStreamPlanContext,
} from '../model/execution-stream';
import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import type { AtlasProjectionInput } from '../server/load-atlas-projection';
import { atlasPostgresMappingOverrides } from './postgres-mapping';
import {
  instrumentAtlasPostgresPool,
  withAtlasPostgresQueryContext,
  type AtlasPostgresQueryObservation,
} from './postgres-observability';
import { createVersionedProjectionSnapshotCache } from './projection-snapshot-cache';

export type AtlasMergeCatchUpCandidate = {
  action: 'append-to-session' | 'create-implicit-session';
  attribution: 'explicit-directive' | 'implicit-single-open';
  id: string;
  mergedAt: string;
  number: number;
  planId: string;
  repositoryFullName: string;
  targetStreamId: string | null;
  title: string;
};

export type AtlasMergeCatchUpSkipped = {
  id: string;
  number: number;
  reason: 'invalid-session' | 'missing-author' | 'unlinked-author' | 'unresolved-plan';
  repositoryFullName: string;
  title: string;
};

export type AtlasMergeCatchUpPreview = {
  alreadyRecorded: number;
  candidates: AtlasMergeCatchUpCandidate[];
  observedPullRequests: number;
  skipped: AtlasMergeCatchUpSkipped[];
  sourceFailures: AtlasProjectionInput['evidenceFailures'];
};

type AtlasMergeActivityInput = Pick<
  AtlasMergedPullRequestInput,
  'authorProviderAccountId' | 'body' | 'mergedAt' | 'number' | 'repositoryFullName'
>;

const hashRevisionSet = (revisionIds: string[]) =>
  createHash('sha256')
    .update([...revisionIds].sort((left, right) => left.localeCompare(right)).join('\0'))
    .digest('hex');

const executionStreamTitle = (planTitle: string) =>
  planTitle.replace(/^\d+[a-z]?\.\s+/i, '').trim() || planTitle;

const advancesActivityTimestamp = (current: string | null, candidate: string) => {
  if (!current) return true;

  const currentTime = Date.parse(current);
  const candidateTime = Date.parse(candidate);

  return (
    Number.isFinite(candidateTime) &&
    (!Number.isFinite(currentTime) || candidateTime > currentTime)
  );
};

const latestActivityTimestamp = (current: string | null, candidate: string): string =>
  advancesActivityTimestamp(current, candidate) ? candidate : (current ?? candidate);

const mergeWebhookPullRequestObservation = (
  projection: AtlasProjectionInput,
  request: AtlasReconciliationRequest,
) => {
  const webhook = request.webhook;

  if (!webhook || !('number' in webhook)) {
    return projection.observedPullRequests;
  }

  const sourceRevision = projection.sourceRevisions.find(
    revision =>
      revision.repository?.toLowerCase() === webhook.repositoryFullName.toLowerCase(),
  );

  if (!sourceRevision) {
    return projection.observedPullRequests;
  }

  const id = `github:${webhook.repositoryFullName.toLowerCase()}#${webhook.number}`;
  const existing = projection.observedPullRequests.find(candidate => candidate.id === id);
  const directives = parseAtlasPullRequestDirectives(webhook.body);
  const observation: AtlasObservedPullRequest = {
    authorAvatarUrl: existing?.authorAvatarUrl ?? null,
    authorProviderAccountId:
      webhook.authorProviderAccountId ?? existing?.authorProviderAccountId ?? null,
    authorLogin: webhook.authorLogin ?? existing?.authorLogin ?? null,
    body: webhook.body,
    directives: directives.length > 0 ? directives : (existing?.directives ?? []),
    id,
    mergeCommitSha: webhook.mergeCommitSha,
    mergedByAvatarUrl: existing?.mergedByAvatarUrl ?? null,
    mergedByLogin: existing?.mergedByLogin ?? null,
    mergedAt: webhook.mergedAt,
    number: webhook.number,
    repositoryFullName: webhook.repositoryFullName,
    sourceId: sourceRevision.sourceId,
    title: webhook.title,
    url: webhook.url,
  };

  return [
    ...projection.observedPullRequests.filter(candidate => candidate.id !== id),
    observation,
  ];
};

const resolveExecutionPlanAttribution = (
  dataset: ReturnType<typeof buildAtlasOntahiDataset>,
  webhook: AtlasMergeActivityInput,
) => {
  const pullRequestId = `github:${webhook.repositoryFullName.toLowerCase()}#${webhook.number}`;
  const context = resolveExecutionStreamPlanContext({
    bindings: dataset.EvidenceBinding,
    plans: dataset.AtlasPlan,
    pullRequestId,
  });

  return context ? { ...context, pullRequestId } : null;
};

const assertUnique = <TValue>(
  entity: string,
  values: TValue[],
  identity: (value: TValue) => string,
) => {
  const seen = new Set<string>();
  const duplicate = values.map(identity).find(value => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });

  if (duplicate) {
    throw new Error(`Atlas projection contains duplicate ${entity} identity: ${duplicate}`);
  }
};

const assertAtlasProjectionIdentities = (dataset: ReturnType<typeof buildAtlasOntahiDataset>) => {
  const entities = Object.entries(dataset) as Array<[string, Array<{ id: string }>]>;
  for (const [entity, rows] of entities) assertUnique(entity, rows, row => row.id);

  assertUnique(
    'AtlasSourceRevision source/revision',
    dataset.AtlasSourceRevision,
    row => `${row.sourceId}\0${row.authority}\0${row.revision}`,
  );
  assertUnique(
    'AtlasSourceRecord source/path',
    dataset.AtlasSourceRecord,
    row => `${row.sourceId}\0${row.sourcePath}`,
  );
  assertUnique('AtlasItem semanticId', dataset.AtlasItem, row => row.semanticId);
  assertUnique('AtlasPlan path', dataset.AtlasPlan, row => row.path);
  assertUnique(
    'PullRequest repository/number',
    dataset.PullRequest,
    row => `${row.repositoryFullName.toLowerCase()}\0${row.number}`,
  );
};

const retainEvidenceFromFailedSources = (input: {
  currentSnapshotJson: string;
  failures: AtlasProjectionInput['evidenceFailures'];
  previousSnapshotJson?: string;
}) => {
  const current = JSON.parse(input.currentSnapshotJson) as PlanWorkstreamSnapshot;

  if (!input.previousSnapshotJson || input.failures.length === 0) {
    return {
      evidenceBindingCount: current.evidence?.length ?? 0,
      snapshotJson: input.currentSnapshotJson,
    };
  }

  const previous = JSON.parse(input.previousSnapshotJson) as PlanWorkstreamSnapshot;
  const failedRepositories = new Set(
    input.failures.map(failure => failure.repositoryFullName.toLowerCase()),
  );
  const currentNodeIds = new Set(current.nodes.map(node => node.id));
  const evidence = [
    ...(previous.evidence ?? []).filter(
      binding =>
        failedRepositories.has(binding.pullRequest.repositoryFullName.toLowerCase()) &&
        currentNodeIds.has(binding.targetNodeId),
    ),
    ...(current.evidence ?? []),
  ];
  const deduplicatedEvidence = [
    ...new Map(evidence.map(binding => [binding.id, binding] as const)).values(),
  ].sort((left, right) => left.id.localeCompare(right.id));

  return {
    evidenceBindingCount: deduplicatedEvidence.length,
    snapshotJson: JSON.stringify({
      ...current,
      evidence: deduplicatedEvidence,
    }),
  };
};

export const createAtlasPostgresApplication = (input: {
  invalidatePresentation?: () => void;
  loadProjection: (request: AtlasReconciliationRequest) => Promise<AtlasProjectionInput>;
  observePostgresQueries?: boolean;
  onPostgresQuery?: (observation: AtlasPostgresQueryObservation) => void;
  pool: Pick<Pool, 'connect' | 'query'>;
}) => {
  let reconcileProjection: (
    request: AtlasReconciliationRequest,
  ) => Effect.Effect<AtlasReconciliationResult>;
  let proposePersistentPlanLink: AtlasCapabilities['runtime']['proposals']['linkPlanToItem'];

  const capabilities: AtlasCapabilities = {
    runtime: {
      projection: {
        reconcile: request => Effect.suspend(() => reconcileProjection(request)),
      },
      proposals: {
        linkPlanToItem: request => proposePersistentPlanLink(request),
      },
    },
  };
  const pool = instrumentAtlasPostgresPool(input.pool, {
    enabled: input.observePostgresQueries,
    observe: input.onPostgresQuery,
  });
  const atlas = createAtlasOntahiApplicationWithStorage({
    storage: createPostgresDataGraphStorage({
      pool,
      overrides: atlasPostgresMappingOverrides,
    }),
    capabilities,
  });
  const entities = atlas.application.graph.entities;
  const projectionSnapshotCache = createVersionedProjectionSnapshotCache({
    readRevisionId: async () => {
      const result = await pool.query<{ id: string }>(
        'SELECT id FROM projection_revisions ORDER BY started_at DESC LIMIT 1',
      );

      return result.rows[0]?.id ?? null;
    },
    readSnapshot: atlas.getProjectionSnapshot,
  });

  const recordMergedPullRequestActivity = (
    webhook: AtlasMergeActivityInput,
    dataset: ReturnType<typeof buildAtlasOntahiDataset>,
  ) =>
    Effect.gen(function* () {
      if (!webhook.authorProviderAccountId) {
        return false;
      }

      const planAttribution = resolveExecutionPlanAttribution(dataset, webhook);
      const sessionDirective = parseAtlasSessionDirective(webhook.body);

      if (!planAttribution) {
        return false;
      }

      const accounts = yield* entities.AtlasAuthAccount.where(account =>
        account.accountId.eq(webhook.authorProviderAccountId!),
      ).run();
      const account = accounts.find(candidate => candidate.providerId === 'github');

      if (!account) {
        return false;
      }

      const priorActivity = yield* entities.AtlasExecutionStreamActivity.where(activity =>
        activity.pullRequestId.eq(planAttribution.pullRequestId),
      )
        .limit(1)
        .run();

      if (priorActivity[0]) {
        return false;
      }

      const streams = yield* entities.AtlasExecutionStream.where(stream =>
        stream.userId.eq(account.userId),
      ).run();
      const activityTarget = resolveExecutionStreamActivityTarget({
        directive: sessionDirective,
        streams,
        userId: account.userId,
      });

      if (activityTarget.kind === 'unrouted') {
        return false;
      }

      let stream = activityTarget.kind === 'existing' ? activityTarget.stream : undefined;
      const timestamp = webhook.mergedAt;
      let streamId: string;

      if (!stream) {
        stream = {
          id: randomUUID(),
          userId: account.userId,
          mode: 'implicit',
          status: 'open',
          title: executionStreamTitle(planAttribution.rootPlans[0].title),
          currentFocusPlanId: planAttribution.focusPlan.id,
          forkedFromStreamId: null,
          openedAt: timestamp,
          closedAt: null,
          archivedAt: null,
          lastActivityAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        yield* entities.AtlasExecutionStream.insert(stream).run();
        streamId = stream.id;
      } else {
        const currentStream = stream;
        const nextLastActivityAt = latestActivityTimestamp(
          currentStream.lastActivityAt,
          timestamp,
        );
        const advancesStream = advancesActivityTimestamp(
          currentStream.lastActivityAt,
          timestamp,
        );
        yield* entities.AtlasExecutionStream.where(candidate =>
          candidate.id.eq(currentStream.id),
        )
          .updateOne({
            archivedAt: advancesStream ? null : currentStream.archivedAt,
            currentFocusPlanId: advancesStream
              ? planAttribution.focusPlan.id
              : currentStream.currentFocusPlanId,
            lastActivityAt: nextLastActivityAt,
            updatedAt: latestActivityTimestamp(currentStream.updatedAt, timestamp),
          })
          .run();
        streamId = currentStream.id;
      }

      if (sessionDirective.kind === 'absent') {
        for (const rootPlan of planAttribution.rootPlans) {
          yield* entities.AtlasExecutionStreamRoot.upsert(
            {
              id: `execution-stream-root:${streamId}:${rootPlan.id}`,
              streamId,
              planId: rootPlan.id,
              addedAt: timestamp,
            },
            { conflictOn: ['id'], strategy: 'ignore' },
          ).run();
        }
      }

      yield* entities.AtlasExecutionStreamActivity.upsert(
        {
          id: `execution-stream-activity:${planAttribution.pullRequestId}`,
          streamId,
          pullRequestId: planAttribution.pullRequestId,
          planId: planAttribution.focusPlan.id,
          kind: 'pull-request-merged',
          attribution:
            activityTarget.kind === 'existing'
              ? activityTarget.attribution
              : 'implicit-single-open',
          occurredAt: timestamp,
          createdAt: timestamp,
        },
        { conflictOn: ['id'], strategy: 'ignore' },
      ).run();

      return true;
    });

  const previewMergeCatchUp = async (): Promise<AtlasMergeCatchUpPreview> => {
    const projection = await input.loadProjection({ trigger: 'catch-up' });
    const dataset = buildAtlasOntahiDataset(
      projection.records,
      projection.observedPullRequests,
      projection.sourceRevisions,
    );
    const [activityRows, accountRows, streamRows] = await Promise.all([
      pool.query<{ pull_request_id: string }>(
        'SELECT pull_request_id FROM atlas_execution_stream_activities',
      ),
      pool.query<{ account_id: string; user_id: string }>(
        "SELECT account_id, user_id::text FROM atlas_auth_accounts WHERE provider_id = 'github'",
      ),
      pool.query<{
        id: string;
        mode: 'explicit' | 'implicit';
        status: 'closed' | 'open';
        user_id: string;
      }>('SELECT id::text, mode, status, user_id::text FROM atlas_execution_streams'),
    ]);
    const recordedPullRequestIds = new Set(
      activityRows.rows.map(row => row.pull_request_id),
    );
    const userIdByAccountId = new Map(
      accountRows.rows.map(row => [row.account_id, row.user_id] as const),
    );
    const simulatedStreams = streamRows.rows.map(row => ({
      id: row.id,
      mode: row.mode,
      status: row.status,
      userId: row.user_id,
    }));
    const candidates: AtlasMergeCatchUpCandidate[] = [];
    const skipped: AtlasMergeCatchUpSkipped[] = [];
    let alreadyRecorded = 0;
    const observedPullRequests = [...projection.observedPullRequests].sort((left, right) =>
      left.mergedAt.localeCompare(right.mergedAt),
    );

    for (const pullRequest of observedPullRequests) {
      if (recordedPullRequestIds.has(pullRequest.id)) {
        alreadyRecorded += 1;
        continue;
      }

      const skip = (reason: AtlasMergeCatchUpSkipped['reason']) => {
        skipped.push({
          id: pullRequest.id,
          number: pullRequest.number,
          reason,
          repositoryFullName: pullRequest.repositoryFullName,
          title: pullRequest.title,
        });
      };
      const activityInput: AtlasMergeActivityInput = {
        authorProviderAccountId: pullRequest.authorProviderAccountId,
        body: pullRequest.body ?? null,
        mergedAt: pullRequest.mergedAt,
        number: pullRequest.number,
        repositoryFullName: pullRequest.repositoryFullName,
      };
      const planAttribution = resolveExecutionPlanAttribution(dataset, activityInput);

      if (!planAttribution) {
        skip('unresolved-plan');
        continue;
      }

      if (!pullRequest.authorProviderAccountId) {
        skip('missing-author');
        continue;
      }

      const userId = userIdByAccountId.get(pullRequest.authorProviderAccountId);

      if (!userId) {
        skip('unlinked-author');
        continue;
      }

      const activityTarget = resolveExecutionStreamActivityTarget({
        directive: parseAtlasSessionDirective(pullRequest.body),
        streams: simulatedStreams,
        userId,
      });

      if (activityTarget.kind === 'unrouted') {
        skip('invalid-session');
        continue;
      }

      if (activityTarget.kind === 'create-implicit') {
        simulatedStreams.push({
          id: `catch-up-preview:${userId}`,
          mode: 'implicit',
          status: 'open',
          userId,
        });
      }

      candidates.push({
        action:
          activityTarget.kind === 'create-implicit'
            ? 'create-implicit-session'
            : 'append-to-session',
        attribution:
          activityTarget.kind === 'existing'
            ? activityTarget.attribution
            : 'implicit-single-open',
        id: pullRequest.id,
        mergedAt: pullRequest.mergedAt,
        number: pullRequest.number,
        planId: planAttribution.focusPlan.id,
        repositoryFullName: pullRequest.repositoryFullName,
        targetStreamId:
          activityTarget.kind === 'existing' ? activityTarget.stream.id : null,
        title: pullRequest.title,
      });
    }

    return {
      alreadyRecorded,
      candidates,
      observedPullRequests: observedPullRequests.length,
      skipped,
      sourceFailures: projection.evidenceFailures,
    };
  };

  proposePersistentPlanLink = request =>
    Effect.promise(async () => {
      const records = await atlas.getSourceRecords();
      return proposePlanLink(parseAtlasSourceRecords(records), request);
    });

  reconcileProjection = request =>
    Effect.promise(() => input.loadProjection(request)).pipe(
      Effect.flatMap(projection => {
        if (request.trigger === 'catch-up' && projection.evidenceFailures.length > 0) {
          return Effect.die(
            new Error(
              `Atlas catch-up requires all evidence sources; ${projection.evidenceFailures.length} source observation(s) failed.`,
            ),
          );
        }

        const observedPullRequests = mergeWebhookPullRequestObservation(projection, request);
        const dataset = buildAtlasOntahiDataset(
          projection.records,
          observedPullRequests,
          projection.sourceRevisions,
        );
        assertAtlasProjectionIdentities(dataset);
        const projectionRevisionId = `projection:${randomUUID()}`;
        const startedAt = projection.observedAt;
        const sourceRevisionSetHash = hashRevisionSet(
          dataset.AtlasSourceRevision.map(revision => revision.id),
        );
        const currentItemIds = new Set(dataset.AtlasItem.map(item => item.id));
        const currentPlanIds = new Set(dataset.AtlasPlan.map(plan => plan.id));
        const currentSourceRecordIds = new Set(dataset.AtlasSourceRecord.map(record => record.id));
        const currentSnapshotJson = dataset.ProjectionRevision[0]?.snapshotJson ?? '{}';
        const diagnosticsJson = JSON.stringify({
          evidenceFailures: projection.evidenceFailures,
        });
        const reconciliationToken = randomUUID();
        const webhook = request.webhook;
        const processingToken = webhook ? randomUUID() : null;
        const sourceForWebhook = webhook
          ? dataset.AtlasSourceRevision.find(
              revision =>
                revision.repository?.toLowerCase() === webhook.repositoryFullName.toLowerCase(),
            )
          : undefined;
        const webhookEvent = webhook ? ('after' in webhook ? 'push' : 'pull_request.closed') : null;
        const webhookSourceRevision = webhook
          ? 'after' in webhook
            ? webhook.after
            : (webhook.mergeCommitSha ?? webhook.mergedAt)
          : null;

        return atlas.application.app.graph.transaction(
          Effect.gen(function* () {
            yield* entities.ProjectionReconciliationLock.upsert(
              {
                id: 'atlas-projection',
                processingToken: reconciliationToken,
                acquiredAt: startedAt,
              },
              { conflictOn: ['id'], strategy: 'merge' },
            ).run();

            if (webhook?.deliveryId && processingToken) {
              yield* entities.WebhookDelivery.upsert(
                {
                  id: webhook.deliveryId,
                  provider: 'github',
                  event: webhookEvent!,
                  sourceId: sourceForWebhook?.sourceId ?? null,
                  sourceRevision: webhookSourceRevision,
                  repositoryFullName: webhook.repositoryFullName,
                  processingToken,
                  receivedAt: startedAt,
                  processedAt: null,
                  projectionRevisionId: null,
                },
                { conflictOn: ['id'], strategy: 'ignore' },
              ).run();
              const deliveries = yield* entities.WebhookDelivery.where(candidate =>
                candidate.id.eq(webhook.deliveryId!),
              )
                .limit(1)
                .run();
              const delivery = deliveries[0];

              if (delivery?.processingToken !== processingToken) {
                return {
                  duplicate: true,
                  evidenceBindingCount: dataset.EvidenceBinding.length,
                  invalidated: true,
                  itemCount: dataset.AtlasItem.length,
                  planCount: dataset.AtlasPlan.length,
                  projectionRevisionId:
                    delivery?.projectionRevisionId ?? 'projection:duplicate-pending',
                  repositoryFullName: webhook.repositoryFullName,
                  sourceCount: dataset.AtlasSourceRevision.length,
                } satisfies AtlasReconciliationResult;
              }
            }

            const latestRevisions = yield* entities.ProjectionRevision.all()
              .orderBy(revision => revision.startedAt.desc())
              .limit(1)
              .run();
            const latestRevision = latestRevisions[0];
            if (latestRevision && Date.parse(latestRevision.startedAt) > Date.parse(startedAt)) {
              if (webhook?.deliveryId && processingToken) {
                yield* entities.WebhookDelivery.where(candidate =>
                  candidate.id.eq(webhook.deliveryId!),
                )
                  .updateOne({
                    processedAt: new Date().toISOString(),
                    projectionRevisionId: latestRevision.id,
                  })
                  .run();
              }

              return {
                duplicate: false,
                evidenceBindingCount: dataset.EvidenceBinding.length,
                invalidated: Boolean(webhook),
                itemCount: dataset.AtlasItem.length,
                planCount: dataset.AtlasPlan.length,
                projectionRevisionId: latestRevision.id,
                repositoryFullName: webhook?.repositoryFullName ?? null,
                sourceCount: dataset.AtlasSourceRevision.length,
              } satisfies AtlasReconciliationResult;
            }

            const { evidenceBindingCount, snapshotJson } = retainEvidenceFromFailedSources({
              currentSnapshotJson,
              failures: projection.evidenceFailures,
              previousSnapshotJson: latestRevision?.snapshotJson,
            });

            for (const sourceId of projection.evidenceSourceIds) {
              yield* entities.EvidenceBinding.where(binding => binding.sourceId.eq(sourceId))
                .delete()
                .run();
            }
            yield* entities.AtlasShapingBinding.all().delete().run();
            yield* entities.AtlasSupportBinding.all().delete().run();
            yield* entities.AtlasPlanRelationBinding.all().delete().run();

            if (dataset.AtlasSourceRevision.length > 0) {
              yield* entities.AtlasSourceRevision.upsertMany(dataset.AtlasSourceRevision, {
                conflictOn: ['id'],
                strategy: 'merge',
              }).run();
            }
            if (dataset.AtlasSourceRecord.length > 0) {
              yield* entities.AtlasSourceRecord.upsertMany(dataset.AtlasSourceRecord, {
                conflictOn: ['id'],
                strategy: 'merge',
              }).run();
            }
            if (dataset.AtlasItem.length > 0) {
              yield* entities.AtlasItem.upsertMany(dataset.AtlasItem, {
                conflictOn: ['id'],
                strategy: 'merge',
              }).run();
            }
            if (dataset.AtlasPlan.length > 0) {
              yield* entities.AtlasPlan.upsertMany(dataset.AtlasPlan, {
                conflictOn: ['id'],
                strategy: 'merge',
              }).run();
            }
            if (currentItemIds.size === 0) {
              yield* entities.AtlasItem.all().delete().run();
            } else {
              yield* entities.AtlasItem.where(item =>
                selectionNot(item.id.in([...currentItemIds])),
              )
                .delete()
                .run();
            }
            if (currentPlanIds.size === 0) {
              yield* entities.AtlasPlan.all().delete().run();
            } else {
              yield* entities.AtlasPlan.where(plan =>
                selectionNot(plan.id.in([...currentPlanIds])),
              )
                .delete()
                .run();
            }
            if (currentSourceRecordIds.size === 0) {
              yield* entities.AtlasSourceRecord.all().delete().run();
            } else {
              yield* entities.AtlasSourceRecord.where(record =>
                selectionNot(record.id.in([...currentSourceRecordIds])),
              )
                .delete()
                .run();
            }
            if (dataset.AtlasShapingBinding.length > 0) {
              yield* entities.AtlasShapingBinding.upsertMany(dataset.AtlasShapingBinding, {
                conflictOn: ['id'],
                strategy: 'merge',
              }).run();
            }
            if (dataset.AtlasSupportBinding.length > 0) {
              yield* entities.AtlasSupportBinding.upsertMany(dataset.AtlasSupportBinding, {
                conflictOn: ['id'],
                strategy: 'merge',
              }).run();
            }
            if (dataset.AtlasPlanRelationBinding.length > 0) {
              yield* entities.AtlasPlanRelationBinding.upsertMany(
                dataset.AtlasPlanRelationBinding,
                { conflictOn: ['id'], strategy: 'merge' },
              ).run();
            }
            if (dataset.PullRequest.length > 0) {
              yield* entities.PullRequest.upsertMany(dataset.PullRequest, {
                conflictOn: ['id'],
                strategy: 'merge',
              }).run();
            }
            if (dataset.EvidenceBinding.length > 0) {
              yield* entities.EvidenceBinding.upsertMany(dataset.EvidenceBinding, {
                conflictOn: ['id'],
                strategy: 'merge',
              }).run();
            }

            if (request.trigger === 'catch-up') {
              const catchUpPullRequests = [...projection.observedPullRequests].sort((left, right) =>
                left.mergedAt.localeCompare(right.mergedAt),
              );

              for (const pullRequest of catchUpPullRequests) {
                yield* recordMergedPullRequestActivity(
                  {
                    authorProviderAccountId: pullRequest.authorProviderAccountId,
                    body: pullRequest.body ?? null,
                    mergedAt: pullRequest.mergedAt,
                    number: pullRequest.number,
                    repositoryFullName: pullRequest.repositoryFullName,
                  },
                  dataset,
                );
              }
            } else if (webhook && 'number' in webhook) {
              yield* recordMergedPullRequestActivity(webhook, dataset);
            }

            const completedAt = new Date().toISOString();
            yield* entities.ProjectionRevision.insert({
              id: projectionRevisionId,
              trigger: request.trigger,
              sourceRevisionSetHash,
              snapshotJson,
              diagnosticsJson,
              startedAt,
              completedAt,
              status: projection.evidenceFailures.length > 0 ? 'degraded' : 'completed',
            }).run();
            if (dataset.AtlasSourceRevision.length > 0) {
              yield* entities.ProjectionSourceRevision.insertMany(
                dataset.AtlasSourceRevision.map(revision => ({
                  id: `${projectionRevisionId}:${revision.id}`,
                  projectionRevisionId,
                  sourceRevisionId: revision.id,
                  sourceId: revision.sourceId,
                })),
              ).run();
            }

            if (webhook?.deliveryId && processingToken) {
              yield* entities.WebhookDelivery.where(candidate =>
                candidate.id.eq(webhook.deliveryId!),
              )
                .updateOne({
                  processedAt: completedAt,
                  projectionRevisionId,
                })
                .run();
            }

            return {
              duplicate: false,
              evidenceBindingCount,
              invalidated: Boolean(webhook),
              itemCount: dataset.AtlasItem.length,
              planCount: dataset.AtlasPlan.length,
              projectionRevisionId,
              repositoryFullName: webhook?.repositoryFullName ?? null,
              sourceCount: dataset.AtlasSourceRevision.length,
            } satisfies AtlasReconciliationResult;
          }),
        );
      }),
      Effect.tap(() =>
        Effect.sync(() => {
          projectionSnapshotCache.invalidate();
          input.invalidatePresentation?.();
        }),
      ),
      Effect.orDie,
    );

  const invokeReconciliationOperation = async (request: AtlasReconciliationRequest) => {
    if (request.trigger === 'webhook' || request.webhook) {
      throw new Error('Webhook reconciliation must enter through its Ontahi ingress operation.');
    }

    const result = await atlas.application.invokeOperation(
      entities.ProjectionRevision.domain.reconcile,
      { trigger: request.trigger },
    );

    if (!result.ok) {
      const failureReason =
        result.kind === 'rejected'
          ? result.reason
          : result.kind === 'failed' &&
              result.failure &&
              typeof result.failure === 'object' &&
              'reason' in result.failure &&
              typeof result.failure.reason === 'string'
            ? result.failure.reason
            : result.kind;
      const internalCause =
        result.kind === 'failed' &&
        result.failure &&
        typeof result.failure === 'object' &&
        'cause' in result.failure
          ? JSON.stringify(result.failure.cause).replace(
              /postgres(?:ql)?:\/\/[^\s"']+/gi,
              '[redacted-postgres-url]',
            )
          : null;
      throw new Error(
        `Atlas reconciliation failed (${failureReason}): ${result.message}${
          internalCause ? `; cause=${internalCause}` : ''
        }`,
      );
    }

    return result.value;
  };

  return {
    ...atlas,
    getProjectionSnapshot: projectionSnapshotCache.read,
    previewMergeCatchUp: () =>
      withAtlasPostgresQueryContext(
        { operation: 'atlas.projection.catch-up-preview', trigger: 'catch-up' },
        previewMergeCatchUp,
      ),
    reconcile: (request: AtlasReconciliationRequest) =>
      withAtlasPostgresQueryContext(
        { operation: 'atlas.projection.reconcile', trigger: request.trigger },
        () => invokeReconciliationOperation(request),
      ),
  };
};
