import { createHash, randomUUID } from 'node:crypto';

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
import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import type { AtlasProjectionInput } from '../server/load-atlas-projection';
import { atlasPostgresMappingOverrides } from './postgres-mapping';

const hashRevisionSet = (revisionIds: string[]) =>
  createHash('sha256')
    .update([...revisionIds].sort((left, right) => left.localeCompare(right)).join('\0'))
    .digest('hex');

const executionStreamTitle = (planTitle: string) =>
  planTitle.replace(/^\d+[a-z]?\.\s+/i, '').trim() || planTitle;

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
  webhook: AtlasMergedPullRequestInput,
) => {
  const pullRequestId = `github:${webhook.repositoryFullName.toLowerCase()}#${webhook.number}`;
  const bindings = dataset.EvidenceBinding.filter(
    binding => binding.pullRequestId === pullRequestId && binding.planId,
  );
  const binding =
    bindings.find(candidate => candidate.kind === 'implements') ?? bindings[0];
  const focusPlan = binding?.planId
    ? dataset.AtlasPlan.find(plan => plan.id === binding.planId)
    : undefined;

  if (!focusPlan) {
    return null;
  }

  const plansById = new Map(dataset.AtlasPlan.map(plan => [plan.id, plan] as const));
  const visited = new Set<string>();
  let rootPlan = focusPlan;

  while (rootPlan.parentPlanId && !visited.has(rootPlan.id)) {
    visited.add(rootPlan.id);
    const parent = plansById.get(rootPlan.parentPlanId);

    if (!parent) {
      break;
    }

    rootPlan = parent;
  }

  return { focusPlan, pullRequestId, rootPlan };
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
  const atlas = createAtlasOntahiApplicationWithStorage({
    storage: createPostgresDataGraphStorage({
      pool: input.pool,
      overrides: atlasPostgresMappingOverrides,
    }),
    capabilities,
  });
  const entities = atlas.application.graph.entities;

  const recordMergedPullRequestActivity = (
    webhook: AtlasMergedPullRequestInput,
    dataset: ReturnType<typeof buildAtlasOntahiDataset>,
  ) =>
    Effect.gen(function* () {
      if (!webhook.authorProviderAccountId) {
        return;
      }

      const planAttribution = resolveExecutionPlanAttribution(dataset, webhook);

      if (!planAttribution) {
        return;
      }

      const accounts = yield* entities.AtlasAuthAccount.where(account =>
        account.accountId.eq(webhook.authorProviderAccountId!),
      ).run();
      const account = accounts.find(candidate => candidate.providerId === 'github');

      if (!account) {
        return;
      }

      const priorActivity = yield* entities.AtlasExecutionStreamActivity.where(activity =>
        activity.pullRequestId.eq(planAttribution.pullRequestId),
      )
        .limit(1)
        .run();

      if (priorActivity[0]) {
        return;
      }

      const streams = yield* entities.AtlasExecutionStream.where(stream =>
        stream.userId.eq(account.userId),
      ).run();
      let stream = streams.find(
        candidate => candidate.mode === 'implicit' && candidate.status === 'open',
      );
      const timestamp = webhook.mergedAt;
      let streamId: string;

      if (!stream) {
        stream = {
          id: randomUUID(),
          userId: account.userId,
          mode: 'implicit',
          status: 'open',
          title: executionStreamTitle(planAttribution.rootPlan.title),
          currentFocusPlanId: planAttribution.focusPlan.id,
          openedAt: timestamp,
          closedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        yield* entities.AtlasExecutionStream.insert(stream).run();
        streamId = stream.id;
      } else {
        const currentStream = stream;
        yield* entities.AtlasExecutionStream.where(candidate =>
          candidate.id.eq(currentStream.id),
        )
          .updateOne({
            currentFocusPlanId: planAttribution.focusPlan.id,
            updatedAt: timestamp,
          })
          .run();
        streamId = currentStream.id;
      }

      yield* entities.AtlasExecutionStreamRoot.upsert(
        {
          id: `execution-stream-root:${streamId}:${planAttribution.rootPlan.id}`,
          streamId,
          planId: planAttribution.rootPlan.id,
          addedAt: timestamp,
        },
        { conflictOn: ['id'], strategy: 'ignore' },
      ).run();

      yield* entities.AtlasExecutionStreamActivity.upsert(
        {
          id: `execution-stream-activity:${planAttribution.pullRequestId}`,
          streamId,
          pullRequestId: planAttribution.pullRequestId,
          planId: planAttribution.focusPlan.id,
          kind: 'pull-request-merged',
          attribution: 'implicit-single-open',
          occurredAt: timestamp,
          createdAt: timestamp,
        },
        { conflictOn: ['id'], strategy: 'ignore' },
      ).run();
    });

  proposePersistentPlanLink = request =>
    Effect.promise(async () => {
      const records = await atlas.getSourceRecords();
      return proposePlanLink(parseAtlasSourceRecords(records), request);
    });

  reconcileProjection = request =>
    Effect.promise(() => input.loadProjection(request)).pipe(
      Effect.flatMap(projection => {
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
            const persistedItems = yield* entities.AtlasItem.all().run();
            const staleItemIds = persistedItems
              .map(item => item.id)
              .filter(id => !currentItemIds.has(id));
            if (staleItemIds.length > 0) {
              yield* entities.AtlasItem.where(item => item.id.in(staleItemIds))
                .delete()
                .run();
            }
            const persistedPlans = yield* entities.AtlasPlan.all().run();
            const stalePlanIds = persistedPlans
              .map(plan => plan.id)
              .filter(id => !currentPlanIds.has(id));
            if (stalePlanIds.length > 0) {
              yield* entities.AtlasPlan.where(plan => plan.id.in(stalePlanIds))
                .delete()
                .run();
            }
            const persistedSourceRecords = yield* entities.AtlasSourceRecord.all().run();
            const staleSourceRecordIds = persistedSourceRecords
              .map(record => record.id)
              .filter(id => !currentSourceRecordIds.has(id));
            if (staleSourceRecordIds.length > 0) {
              yield* entities.AtlasSourceRecord.where(record => record.id.in(staleSourceRecordIds))
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

            if (webhook && 'number' in webhook) {
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
      Effect.tap(() => Effect.sync(() => input.invalidatePresentation?.())),
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
    reconcile: invokeReconciliationOperation,
  };
};
