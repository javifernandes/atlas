import { createHash, randomUUID } from 'node:crypto';

import { selectionNot } from '@ontahi/core';
import { createInProcessTaskRuntime } from '@ontahi/core/runtime/server';
import { createPostgresDataGraphStorage } from '@ontahi/postgres/data-graph';
import { createPostgresTaskStorage } from '@ontahi/postgres/tasks';
import { Effect } from 'effect';
import type { Pool } from 'pg';

import {
  ATLAS_PULL_REQUEST_EVIDENCE_MATERIALIZER_ID,
  buildAtlasOntahiDataset,
  buildAtlasOntahiDatasetFromSource,
  createAtlasOntahiApplicationWithStorage,
  createAtlasPullRequestEvidenceMaterializer,
  type AtlasMergedPullRequestInput,
  type AtlasPullRequestEvidenceCheckpoint,
  type AtlasCapabilities,
  type AtlasReconciliationRequest,
  type AtlasReconciliationResult,
} from '../domain/atlas-application';
import {
  parseAtlasPullRequestDirectives,
  pullRequestsFromAcceptedEvidence,
  type AtlasObservedPullRequest,
} from '../github/pull-request-evidence';
import { parseAtlasSourceRecords } from '../markdown/build-snapshot';
import {
  ATLAS_PARSED_RECORD_MATERIALIZER_ID,
  parseAtlasSourceRecordArtifact,
} from '../markdown/parsed-record-artifact';
import {
  ATLAS_PARSED_RECORD_MATERIALIZATION_SCOPE,
  materializeAtlasParsedRecords,
} from '../markdown/parsed-record-materialization';
import { proposePlanLink } from '../domain/plan-link-proposal';
import {
  parseAtlasSessionDirective,
  resolveExecutionStreamActivityTarget,
  resolveExecutionStreamPlanContext,
} from '../model/execution-stream';
import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import type { AtlasWorkspaceCapabilities } from '../workspace/workspace-entities';
import type {
  AtlasProjectionInput,
  AtlasProjectionSourceBaseline,
} from '../server/load-atlas-projection';
import { deriveWorkspaceContributors } from '../workspace/workspace-contributors';
import type { AtlasWorkspaceSourceReconciler } from '../workspace/workspace-source-reconciliation';
import { atlasPostgresMappingOverrides } from './postgres-mapping';
import { createPortableAtlasPostgresPool } from './postgres-portability';
import {
  instrumentAtlasPostgresPool,
  withAtlasPostgresQueryContext,
  type AtlasPostgresQueryObservation,
} from './postgres-observability';
import { createVersionedProjectionSnapshotCache } from './projection-snapshot-cache';
import { createAtlasParsedRecordMaterializationStore } from './parsed-record-materialization-store';
import {
  createAtlasReconciliationStageObserver,
  type AtlasReconciliationStageObserver,
} from './reconciliation-observability';

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
  eligiblePullRequests: number;
  excludedBeforeSince: number;
  observedPullRequests: number;
  since: string;
  skipped: AtlasMergeCatchUpSkipped[];
  sourceFailures: AtlasProjectionInput['evidenceFailures'];
};

type AtlasMergeActivityInput = Pick<
  AtlasMergedPullRequestInput,
  'authorProviderAccountId' | 'body' | 'mergedAt' | 'number' | 'repositoryFullName'
>;

type ReconciliationExecution = {
  invalidatePresentation: boolean;
  result: AtlasReconciliationResult;
  workspaceFanOut: boolean;
};

const hashRevisionSet = (revisionIds: string[]) =>
  createHash('sha256')
    .update([...revisionIds].sort((left, right) => left.localeCompare(right)).join('\0'))
    .digest('hex');

const executionStreamTitle = (planTitle: string) =>
  planTitle.replace(/^\d+[a-z]?\.\s+/i, '').trim() || planTitle;

const requireCatchUpSince = (value: string | null | undefined) => {
  const timestamp = Date.parse(value ?? '');

  if (!value || !Number.isFinite(timestamp)) {
    throw new Error('Atlas catch-up requires a valid ISO-8601 lower bound.');
  }

  return { iso: new Date(timestamp).toISOString(), timestamp };
};

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
  const pullRequests = projection.acceptedPullRequestEvidence
    ? pullRequestsFromAcceptedEvidence(projection.acceptedPullRequestEvidence)
    : projection.observedPullRequests;
  const webhook = request.webhook;

  if (!webhook || !('number' in webhook)) {
    return pullRequests;
  }

  const sourceRevision = projection.sourceRevisions.find(
    revision =>
      revision.repository?.toLowerCase() === webhook.repositoryFullName.toLowerCase(),
  );

  if (!sourceRevision) {
    return pullRequests;
  }

  const id = `github:${webhook.repositoryFullName.toLowerCase()}#${webhook.number}`;
  const existing = pullRequests.find(candidate => candidate.id === id);
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
    ...pullRequests.filter(candidate => candidate.id !== id),
    observation,
  ];
};

const resolveExecutionPlanAttribution = (
  dataset: Pick<ReturnType<typeof buildAtlasOntahiDataset>, 'AtlasPlan' | 'EvidenceBinding'>,
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
  assistantProvider?: NonNullable<AtlasWorkspaceCapabilities['runtime']['assistant']>['provider'];
  invalidatePresentation?: () => void;
  loadProjection: (
    request: AtlasReconciliationRequest,
    baseline?: AtlasProjectionSourceBaseline,
    reconciliationObserver?: AtlasReconciliationStageObserver,
  ) => Promise<AtlasProjectionInput>;
  observePostgresQueries?: boolean;
  onPostgresQuery?: (observation: AtlasPostgresQueryObservation) => void;
  parseRecordArtifact?: typeof parseAtlasSourceRecordArtifact;
  pool: Pick<Pool, 'connect' | 'query'>;
  reconcileWorkspaceSources?: AtlasWorkspaceSourceReconciler['reconcile'];
}) => {
  let reconcileProjection: (
    request: AtlasReconciliationRequest,
  ) => Effect.Effect<AtlasReconciliationResult>;
  let proposePersistentPlanLink: AtlasCapabilities['runtime']['proposals']['linkPlanToItem'];

  const capabilities: AtlasCapabilities = {
    runtime: {
      ...(input.assistantProvider ? { assistant: {
        provider: input.assistantProvider,
        authorize: (userId, workspaceId) =>
          Effect.promise(async () => {
            const result = await input.pool.query<{ authorized: boolean }>(
              `
                SELECT EXISTS (
                  SELECT 1
                  FROM atlas_workspace_memberships
                  WHERE user_id = $1
                    AND workspace_id = $2
                    AND status = 'active'
                ) AS authorized
              `,
              [userId, workspaceId],
            );
            return result.rows[0]?.authorized === true;
          }),
        retrievePlans: question =>
          Effect.promise(async () => {
            const result = await input.pool.query<{
              id: string;
              path: string;
              title: string;
              status: string;
              markdown: string;
            }>(
              `
                SELECT
                  plan.id,
                  plan.path,
                  plan.title,
                  plan.status,
                  record.content AS markdown
                FROM atlas_plans AS plan
                JOIN atlas_source_records AS record ON record.id = plan.source_record_id
                WHERE to_tsvector('simple', plan.title || ' ' || plan.path || ' ' || record.content)
                  @@ plainto_tsquery('simple', $1)
                ORDER BY
                  ts_rank(
                    to_tsvector('simple', plan.title || ' ' || plan.path || ' ' || record.content),
                    plainto_tsquery('simple', $1)
                  ) DESC,
                  plan.path ASC
                LIMIT 8
              `,
              [question],
            );
            return result.rows;
          }),
      } } : {}),
      workspaceAuthorization: {
        roleFor: (userId, workspaceId) =>
          Effect.promise(async () => {
            const result = await input.pool.query<{ role: 'owner' | 'collaborator' | 'viewer' }>(
              `
                SELECT role
                FROM atlas_workspace_memberships
                WHERE user_id = $1
                  AND workspace_id = $2
                  AND status = 'active'
                LIMIT 1
              `,
              [userId, workspaceId],
            );
            return result.rows[0]?.role ?? null;
          }),
      },
      projection: {
        reconcile: request => Effect.suspend(() => reconcileProjection(request)),
      },
      proposals: {
        linkPlanToItem: request => proposePersistentPlanLink(request),
      },
    },
  };
  const pool = createPortableAtlasPostgresPool(
    instrumentAtlasPostgresPool(input.pool, {
      enabled: input.observePostgresQueries,
      observe: input.onPostgresQuery,
    }),
  );
  const taskStorage = createPostgresTaskStorage({ pool: input.pool });
  const evidenceMaterializationStore =
    createAtlasParsedRecordMaterializationStore<AtlasPullRequestEvidenceCheckpoint['state']>(pool);
  const parsedRecordMaterializationStore = createAtlasParsedRecordMaterializationStore(pool);
  const atlas = createAtlasOntahiApplicationWithStorage({
    storage: createPostgresDataGraphStorage({
      pool,
      overrides: atlasPostgresMappingOverrides,
    }),
    taskStorage,
    tasks: { runtime: createInProcessTaskRuntime({ storage: taskStorage }) },
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
  const pageProjectionSnapshotCache = createVersionedProjectionSnapshotCache({
    readRevisionId: async () => {
      const result = await pool.query<{ id: string }>(
        'SELECT id FROM projection_revisions ORDER BY started_at DESC LIMIT 1',
      );

      return result.rows[0]?.id ?? null;
    },
    readSnapshot: async () => {
      const result = await pool.query<{ snapshot: PlanWorkstreamSnapshot }>(`
        WITH latest AS (
          SELECT snapshot_json::jsonb AS snapshot
          FROM projection_revisions
          ORDER BY started_at DESC
          LIMIT 1
        )
        SELECT jsonb_set(
          jsonb_set(
            snapshot,
            '{nodes}',
            (
              SELECT COALESCE(jsonb_agg(node - 'markdown'), '[]'::jsonb)
              FROM jsonb_array_elements(COALESCE(snapshot -> 'nodes', '[]'::jsonb)) AS node
            )
          ),
          '{documents}',
          (
            SELECT COALESCE(jsonb_agg(document - 'markdown'), '[]'::jsonb)
            FROM jsonb_array_elements(COALESCE(snapshot -> 'documents', '[]'::jsonb)) AS document
          )
        ) AS snapshot
        FROM latest
      `);

      return result.rows[0]?.snapshot ?? null;
    },
  });
  const readWorkspacePageProjection = async (workspaceId: string) => {
    const result = await pool.query<{ id: string; snapshot: PlanWorkstreamSnapshot }>(
      `
        SELECT revision.id,
          (revision.snapshot_json::jsonb - 'nodes' - 'documents')
          || jsonb_build_object(
            'nodes', COALESCE(
              (
                SELECT jsonb_agg(node - 'markdown')
                FROM jsonb_array_elements(revision.snapshot_json::jsonb -> 'nodes') AS node
              ),
              '[]'::jsonb
            ),
            'documents', COALESCE(
              (
                SELECT jsonb_agg(document - 'markdown')
                FROM jsonb_array_elements(
                  COALESCE(revision.snapshot_json::jsonb -> 'documents', '[]'::jsonb)
                ) AS document
              ),
              '[]'::jsonb
            )
          ) AS snapshot
        FROM atlas_workspace_projection_revisions AS revision
        WHERE revision.workspace_id = $1
        ORDER BY revision.started_at DESC, revision.id DESC
        LIMIT 1
      `,
      [workspaceId],
    );

    return result.rows[0] ?? null;
  };

  const getProjectionNodeContent = async (nodeId: string, workspaceId?: string) => {
    const result = await pool.query<{ markdown: string | null }>(
      workspaceId
        ? `
        WITH latest AS (
          SELECT snapshot_json::jsonb AS snapshot
          FROM atlas_workspace_projection_revisions
          WHERE workspace_id = $2
          ORDER BY started_at DESC, id DESC
          LIMIT 1
        ), candidates AS (
          SELECT node
          FROM latest,
            LATERAL jsonb_array_elements(COALESCE(snapshot -> 'nodes', '[]'::jsonb)) AS node
          UNION ALL
          SELECT document
          FROM latest,
            LATERAL jsonb_array_elements(COALESCE(snapshot -> 'documents', '[]'::jsonb)) AS document
        )
        SELECT node ->> 'markdown' AS markdown
        FROM candidates
        WHERE node ->> 'id' = $1
        LIMIT 1
      `
        : `
        WITH latest AS (
          SELECT snapshot_json::jsonb AS snapshot
          FROM projection_revisions
          ORDER BY started_at DESC
          LIMIT 1
        ), candidates AS (
          SELECT node
          FROM latest,
            LATERAL jsonb_array_elements(COALESCE(snapshot -> 'nodes', '[]'::jsonb)) AS node
          UNION ALL
          SELECT document
          FROM latest,
            LATERAL jsonb_array_elements(COALESCE(snapshot -> 'documents', '[]'::jsonb)) AS document
        )
        SELECT node ->> 'markdown' AS markdown
        FROM candidates
        WHERE node ->> 'id' = $1
        LIMIT 1
      `,
      workspaceId ? [nodeId, workspaceId] : [nodeId],
    );

    return result.rows.length > 0 ? (result.rows[0]?.markdown ?? '') : null;
  };

  const recordMergedPullRequestActivity = (
    webhook: AtlasMergeActivityInput,
    dataset: Pick<ReturnType<typeof buildAtlasOntahiDataset>, 'AtlasPlan' | 'EvidenceBinding'>,
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

  const readDuplicateWebhookResult = async (
    request: AtlasReconciliationRequest,
  ): Promise<ReconciliationExecution | null> => {
    const webhook = request.webhook;
    if (!webhook?.deliveryId) return null;

    const deliveryResult = await pool.query<{
      projection_revision_id: string | null;
      repository_full_name: string;
    }>(
      `
        SELECT projection_revision_id, repository_full_name
        FROM webhook_deliveries
        WHERE id = $1
        LIMIT 1
      `,
      [webhook.deliveryId],
    );
    const delivery = deliveryResult.rows[0];
    if (!delivery) return null;

    const summaryResult = await pool.query<{
      evidence_binding_count: number;
      item_count: number;
      latest_projection_revision_id: string | null;
      plan_count: number;
      source_count: number;
    }>(
      `
        SELECT
          (SELECT count(*)::int FROM evidence_bindings) AS evidence_binding_count,
          (SELECT count(*)::int FROM atlas_items) AS item_count,
          (
            SELECT id
            FROM projection_revisions
            ORDER BY started_at DESC
            LIMIT 1
          ) AS latest_projection_revision_id,
          (SELECT count(*)::int FROM atlas_plans) AS plan_count,
          (
            SELECT count(*)::int
            FROM projection_source_revisions
            WHERE projection_revision_id = COALESCE(
              $1,
              (
                SELECT id
                FROM projection_revisions
                ORDER BY started_at DESC
                LIMIT 1
              )
            )
          ) AS source_count
      `,
      [delivery.projection_revision_id],
    );
    const summary = summaryResult.rows[0];

    return {
      invalidatePresentation: false,
      workspaceFanOut: false,
      result: {
        duplicate: true,
        evidenceBindingCount: summary?.evidence_binding_count ?? 0,
        invalidated: false,
        itemCount: summary?.item_count ?? 0,
        planCount: summary?.plan_count ?? 0,
        projectionRevisionId:
          delivery.projection_revision_id ??
          summary?.latest_projection_revision_id ??
          'projection:duplicate-pending',
        repositoryFullName: delivery.repository_full_name,
        sourceCount: summary?.source_count ?? 0,
      },
    };
  };

  const tryCoalesceWebhook = (
    request: AtlasReconciliationRequest,
  ): Effect.Effect<ReconciliationExecution | null, unknown> => {
    const webhook = request.webhook;
    const revision = webhook
      ? 'after' in webhook
        ? webhook.after
        : webhook.mergeCommitSha
      : null;

    if (!webhook?.deliveryId || !revision) return Effect.succeed(null);

    return Effect.promise(async () => {
      const match = await pool.query<{
        projection_revision_id: string;
        snapshot_json: string;
        source_id: string;
        source_revision_id: string;
        source_revision_set_hash: string;
        started_at: string;
      }>(
        `
          WITH latest AS (
            SELECT id, snapshot_json, source_revision_set_hash, started_at
            FROM projection_revisions
            ORDER BY started_at DESC
            LIMIT 1
          )
          SELECT
            latest.id AS projection_revision_id,
            latest.snapshot_json,
            latest.started_at,
            source_revision.source_id,
            source_revision.id AS source_revision_id,
            latest.source_revision_set_hash
          FROM latest
          JOIN projection_source_revisions AS lineage
            ON lineage.projection_revision_id = latest.id
          JOIN atlas_source_revisions AS source_revision
            ON source_revision.id = lineage.source_revision_id
          WHERE lower(source_revision.repository) = lower($1)
            AND source_revision.revision = $2
          LIMIT 1
        `,
        [webhook.repositoryFullName, revision],
      );
      const matchedProjection = match.rows[0];
      if (!matchedProjection) return null;

      const [lineage, plans, items, counts] = await Promise.all([
        pool.query<{ source_id: string; source_revision_id: string }>(
          `
            SELECT source_id, source_revision_id
            FROM projection_source_revisions
            WHERE projection_revision_id = $1
          `,
          [matchedProjection.projection_revision_id],
        ),
        pool.query<{ id: string; path: string; source_id: string; title: string }>(
          'SELECT id, path, source_id, title FROM atlas_plans',
        ),
        pool.query<{ canonical_path: string; id: string; semantic_id: string }>(`
          SELECT item.id, item.semantic_id, record.canonical_path
          FROM atlas_items AS item
          JOIN atlas_source_records AS record ON record.id = item.source_record_id
        `),
        pool.query<{
          evidence_binding_count: number;
          item_count: number;
          plan_count: number;
        }>(`
          SELECT
            (SELECT count(*)::int FROM evidence_bindings) AS evidence_binding_count,
            (SELECT count(*)::int FROM atlas_items) AS item_count,
            (SELECT count(*)::int FROM atlas_plans) AS plan_count
        `),
      ]);

      return {
        counts: counts.rows[0],
        items: items.rows,
        lineage: lineage.rows,
        matchedProjection,
        plans: plans.rows,
      };
    }).pipe(
      Effect.flatMap(context => {
        if (!context) return Effect.succeed(null);

        const processingToken = randomUUID();
        const receivedAt = new Date().toISOString();
        const event = 'after' in webhook ? 'push' : 'pull_request.closed';

        return atlas.application.app.graph.transaction(Effect.gen(function* () {
          yield* entities.WebhookDelivery.upsert(
            {
              id: webhook.deliveryId!,
              provider: 'github',
              event,
              sourceId: context.matchedProjection.source_id,
              sourceRevision: revision,
              repositoryFullName: webhook.repositoryFullName,
              processingToken,
              receivedAt,
              processedAt: null,
              projectionRevisionId: null,
            },
            { conflictOn: ['id'], strategy: 'ignore' },
          ).run();
          const [delivery] = yield* entities.WebhookDelivery.where(candidate =>
            candidate.id.eq(webhook.deliveryId!),
          )
            .limit(1)
            .run();

          if (delivery?.processingToken !== processingToken) {
            return {
              invalidatePresentation: false,
              workspaceFanOut: false,
              result: {
                duplicate: true,
                evidenceBindingCount: context.counts?.evidence_binding_count ?? 0,
                invalidated: false,
                itemCount: context.counts?.item_count ?? 0,
                planCount: context.counts?.plan_count ?? 0,
                projectionRevisionId:
                  delivery?.projectionRevisionId ?? context.matchedProjection.projection_revision_id,
                repositoryFullName: webhook.repositoryFullName,
                sourceCount: context.lineage.length,
              },
            } satisfies ReconciliationExecution;
          }

          if ('after' in webhook) {
            yield* entities.WebhookDelivery.where(candidate =>
              candidate.id.eq(webhook.deliveryId!),
            )
              .updateOne({
                processedAt: receivedAt,
                projectionRevisionId: context.matchedProjection.projection_revision_id,
              })
              .run();

            return {
              invalidatePresentation: false,
              workspaceFanOut: false,
              result: {
                duplicate: false,
                evidenceBindingCount: context.counts?.evidence_binding_count ?? 0,
                invalidated: false,
                itemCount: context.counts?.item_count ?? 0,
                planCount: context.counts?.plan_count ?? 0,
                projectionRevisionId: context.matchedProjection.projection_revision_id,
                repositoryFullName: webhook.repositoryFullName,
                sourceCount: context.lineage.length,
              },
            } satisfies ReconciliationExecution;
          }

          const pullRequestId = `github:${webhook.repositoryFullName.toLowerCase()}#${webhook.number}`;
          const cleanTarget = (value: string) => value.trim().replace(/^`|`$/g, '');
          const resolveTarget = (value: string) => {
            const clean = cleanTarget(value);
            const basename = clean.split('/').at(-1)?.replace(/\.md$/, '') ?? clean;
            const sourceRelative = clean.startsWith('plans/') || /^\d+[a-z]?(?:-|$)/i.test(clean)
              ? `${context.matchedProjection.source_id}://plans/${basename}`
              : null;
            const plan = context.plans.find(candidate =>
              candidate.path === clean ||
              candidate.path === sourceRelative ||
              (candidate.source_id === context.matchedProjection.source_id &&
                candidate.path.split('/plans/').at(-1)?.toLowerCase() === clean.toLowerCase()),
            );
            if (plan) return { id: plan.id, kind: 'plan' as const };

            const item = context.items.find(candidate =>
              candidate.semantic_id === clean || candidate.canonical_path === clean,
            );
            return item ? { id: item.id, kind: 'item' as const } : null;
          };
          const bindings = parseAtlasPullRequestDirectives(webhook.body).flatMap(directive => {
            const target = resolveTarget(directive.target);
            if (!target) return [];

            return [{
              id: `${pullRequestId}->${target.id}:${directive.kind}`,
              pullRequestId,
              itemId: target.kind === 'item' ? target.id : null,
              planId: target.kind === 'plan' ? target.id : null,
              targetNodeId: target.id,
              targetKind: target.kind,
              kind: directive.kind,
              provenance: 'explicit' as const,
              sourceId: context.matchedProjection.source_id,
              sourceAuthority: 'github' as const,
              sourceRevision: revision,
            }];
          });
          const pullRequest = {
            id: pullRequestId,
            authorAvatarUrl: null,
            authorProviderAccountId: webhook.authorProviderAccountId,
            authorLogin: webhook.authorLogin,
            mergeCommitSha: webhook.mergeCommitSha,
            mergedByAvatarUrl: null,
            mergedByLogin: null,
            mergedAt: webhook.mergedAt,
            number: webhook.number,
            repositoryFullName: webhook.repositoryFullName,
            sourceId: context.matchedProjection.source_id,
            sourceAuthority: 'github' as const,
            sourceRevision: revision,
            observedAt: webhook.mergedAt,
            title: webhook.title,
            url: webhook.url,
          };

          yield* entities.PullRequest.upsert(pullRequest, {
            conflictOn: ['id'],
            strategy: 'merge',
          }).run();
          yield* entities.EvidenceBinding.where(binding =>
            binding.pullRequestId.eq(pullRequestId),
          ).delete().run();
          if (bindings.length > 0) {
            yield* entities.EvidenceBinding.upsertMany(bindings, {
              conflictOn: ['id'],
              strategy: 'merge',
            }).run();
          }

          yield* recordMergedPullRequestActivity(webhook, {
            AtlasPlan: yield* entities.AtlasPlan.all().run(),
            EvidenceBinding: bindings,
          });

          const priorSnapshot = JSON.parse(
            context.matchedProjection.snapshot_json,
          ) as PlanWorkstreamSnapshot;
          const evidence = [
            ...(priorSnapshot.evidence ?? []).filter(
              candidate => !candidate.id.startsWith(`${pullRequestId}->`),
            ),
            ...bindings.map(binding => ({
              id: binding.id,
              kind: binding.kind,
              provenance: binding.provenance,
              targetNodeId: binding.targetNodeId,
              pullRequest: {
                authorAvatarUrl: null,
                authorLogin: webhook.authorLogin,
                mergeCommitSha: webhook.mergeCommitSha,
                mergedByAvatarUrl: null,
                mergedByLogin: null,
                mergedAt: webhook.mergedAt,
                number: webhook.number,
                repositoryFullName: webhook.repositoryFullName,
                title: webhook.title,
                url: webhook.url,
              },
            })),
          ].sort((left, right) => left.id.localeCompare(right.id));
          const projectionRevisionId = `projection:${randomUUID()}`;
          const completedAt = new Date().toISOString();
          const startedAt = new Date(
            Date.parse(context.matchedProjection.started_at) + 1,
          ).toISOString();

          yield* entities.ProjectionRevision.insert({
            id: projectionRevisionId,
            trigger: 'webhook',
            sourceRevisionSetHash: context.matchedProjection.source_revision_set_hash,
            snapshotJson: JSON.stringify({ ...priorSnapshot, evidence }),
            diagnosticsJson: JSON.stringify({
              coalescedFrom: context.matchedProjection.projection_revision_id,
              deliveryId: webhook.deliveryId,
              mode: 'merged-pr-evidence',
            }),
            startedAt,
            completedAt,
            status: 'completed',
          }).run();
          if (context.lineage.length > 0) {
            yield* entities.ProjectionSourceRevision.insertMany(
              context.lineage.map(source => ({
                id: `${projectionRevisionId}:${source.source_revision_id}`,
                projectionRevisionId,
                sourceRevisionId: source.source_revision_id,
                sourceId: source.source_id,
              })),
            ).run();
          }
          yield* entities.WebhookDelivery.where(candidate =>
            candidate.id.eq(webhook.deliveryId!),
          )
            .updateOne({ processedAt: completedAt, projectionRevisionId })
            .run();

          return {
            invalidatePresentation: true,
            workspaceFanOut: false,
            result: {
              duplicate: false,
              evidenceBindingCount: evidence.length,
              invalidated: true,
              itemCount: context.counts?.item_count ?? 0,
              planCount: context.counts?.plan_count ?? 0,
              projectionRevisionId,
              repositoryFullName: webhook.repositoryFullName,
              sourceCount: context.lineage.length,
            },
          } satisfies ReconciliationExecution;
        }));
      }),
    );
  };

  const previewMergeCatchUp = async (previewInput: {
    since: string;
  }): Promise<AtlasMergeCatchUpPreview> => {
    const catchUpSince = requireCatchUpSince(previewInput.since);
    const projection = await input.loadProjection({
      catchUpSince: catchUpSince.iso,
      trigger: 'catch-up',
    });
    const dataset = buildAtlasOntahiDataset(
      projection.records,
      projection.observedPullRequests,
      projection.sourceRevisions,
      projection.observedReleases ?? [],
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
    const allObservedPullRequests = [...projection.observedPullRequests].sort((left, right) =>
      left.mergedAt.localeCompare(right.mergedAt),
    );
    const observedPullRequests = allObservedPullRequests.filter(
      pullRequest => Date.parse(pullRequest.mergedAt) >= catchUpSince.timestamp,
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
      eligiblePullRequests: observedPullRequests.length,
      excludedBeforeSince: allObservedPullRequests.length - observedPullRequests.length,
      observedPullRequests: allObservedPullRequests.length,
      since: catchUpSince.iso,
      skipped,
      sourceFailures: projection.evidenceFailures,
    };
  };

  const reconcileWorkspaceWebhook = (
    webhook: NonNullable<AtlasReconciliationRequest['webhook']>,
  ) => Effect.gen(function* () {
    if (!input.reconcileWorkspaceSources || !webhook.deliveryId) return;

    const matchingSources = yield* entities.AtlasWorkspaceSource
      .where(source => source.status.eq('active'))
      .where(source => source.provider.eq('github'))
      .where(source => source.providerInstallationId.eq(webhook.installationId))
      .run();
    const matchingByWorkspace = new Map(
      matchingSources
        .filter(source =>
          source.repository?.toLocaleLowerCase() ===
          webhook.repositoryFullName.toLocaleLowerCase(),
        )
        .map(source => [source.workspaceId, source]),
    );

    for (const [workspaceId, triggerSource] of matchingByWorkspace) {
      const previous = yield* entities.AtlasWorkspaceSourceImport
        .where(sourceImport => sourceImport.workspaceId.eq(workspaceId))
        .where(sourceImport => sourceImport.providerDeliveryId.eq(webhook.deliveryId))
        .limit(1)
        .run();
      if (previous[0]) continue;

      const sources = yield* entities.AtlasWorkspaceSource
        .where(source => source.workspaceId.eq(workspaceId))
        .where(source => source.status.eq('active'))
        .run();
      const id = randomUUID();
      const startedAt = new Date().toISOString();
      const trigger = 'after' in webhook ? 'push' as const : 'pull-request' as const;
      const triggerRevision = 'after' in webhook
        ? webhook.after
        : webhook.mergeCommitSha;
      const pullRequestNumber = 'number' in webhook ? webhook.number : null;

      yield* entities.AtlasWorkspaceSourceImport.insert({
        id,
        workspaceId,
        triggerSourceId: triggerSource.id,
        trigger,
        providerDeliveryId: webhook.deliveryId,
        triggerRevision,
        pullRequestNumber,
        repository: triggerSource.repository,
        observedRevision: null,
        sourceRevisionsJson: '[]',
        status: 'running',
        startedAt,
        completedAt: null,
        error: null,
        diagnosticsJson: JSON.stringify({ installationId: webhook.installationId }),
      }).run();

      yield* Effect.tryPromise({
        try: () => input.reconcileWorkspaceSources!({
          workspaceId,
          sources: sources.flatMap(source =>
            source.repository
              ? [{ id: source.sourceId, repository: source.repository, ref: source.ref }]
              : [],
          ),
        }),
        catch: cause => cause,
      }).pipe(Effect.matchEffect({
        onFailure: cause => {
          const error = cause instanceof Error ? cause.message : String(cause);
          return entities.AtlasWorkspaceSourceImport
            .where(candidate => candidate.id.eq(id))
            .update({ status: 'failed', completedAt: new Date().toISOString(), error })
            .run();
        },
        onSuccess: result => {
          const completedAt = new Date().toISOString();
          const projectionRevisionId = randomUUID();
          const observedRevision = result.sourceRevisions.find(
            revision => revision.sourceId === triggerSource.sourceId,
          )?.revision ?? null;
          return atlas.application.app.graph.transaction(Effect.gen(function* () {
            yield* entities.AtlasWorkspaceProjectionRevision.insert({
              id: projectionRevisionId,
              workspaceId,
              importId: id,
              sourceRevisionSetHash: result.sourceRevisionSetHash,
              snapshotJson: JSON.stringify(result.snapshot),
              startedAt,
              createdAt: completedAt,
            }).run();
            yield* entities.AtlasWorkspaceSourceImport
              .where(candidate => candidate.id.eq(id))
              .update({
                status: 'completed',
                completedAt,
                observedRevision,
                sourceRevisionsJson: JSON.stringify(result.sourceRevisions),
              })
              .run();
          }));
        },
      }));
    }
  });

  proposePersistentPlanLink = request =>
    Effect.promise(async () => {
      const records = await atlas.getSourceRecords();
      return proposePlanLink(parseAtlasSourceRecords(records), request);
    });

  const loadSourceBaseline = async (): Promise<AtlasProjectionSourceBaseline> => {
    const result = await input.pool.query<{
      authority: 'markdown';
      canonical_path: string;
      content: string;
      observed_at: string;
      projection_revision_id: string | null;
      repository: string | null;
      revision: string;
      revision_id: string;
      revision_kind: 'git' | 'content-sha256';
      source_file_path: string | null;
      source_id: string;
      source_path: string;
    }>(`
      SELECT
        record.canonical_path,
        record.content,
        record.source_file_path,
        record.source_id,
        record.source_path,
        revision.authority,
        revision.id AS revision_id,
        revision.observed_at,
        latest_projection.id AS projection_revision_id,
        revision.repository,
        revision.revision,
        revision.revision_kind
      FROM atlas_source_records AS record
      JOIN atlas_source_revisions AS revision ON revision.id = record.source_revision_id
      CROSS JOIN LATERAL (
        SELECT projection.id
        FROM projection_revisions AS projection
        ORDER BY projection.started_at DESC
        LIMIT 1
      ) AS latest_projection
      ORDER BY record.source_id, record.source_path
    `);
    const revisions = new Map<string, AtlasProjectionSourceBaseline['sourceRevisions'][number]>();

    for (const row of result.rows) {
      revisions.set(row.source_id, {
        authority: row.authority,
        id: row.revision_id,
        observedAt: row.observed_at,
        repository: row.repository,
        revision: row.revision,
        revisionKind: row.revision_kind,
        sourceId: row.source_id,
      });
    }

    return {
      projectionRevisionId: result.rows[0]?.projection_revision_id ?? null,
      records: result.rows.map(row => ({
        canonicalPath: row.canonical_path,
        content: row.content,
        sourceFilePath: row.source_file_path ?? undefined,
        sourceId: row.source_id,
        sourcePath: row.source_path,
        sourceRepository: row.repository ?? undefined,
        sourceRevision: row.revision,
        sourceRevisionKind: row.revision_kind,
      })),
      sourceRevisions: [...revisions.values()],
    };
  };

  reconcileProjection = request => {
    const reconciliationObserver = createAtlasReconciliationStageObserver({
      repositoryFullName: request.webhook?.repositoryFullName,
      trigger: request.trigger,
    });

    return Effect.promise(() => readDuplicateWebhookResult(request)).pipe(
      Effect.flatMap(duplicateResult =>
        duplicateResult
          ? Effect.succeed(duplicateResult)
          : tryCoalesceWebhook(request).pipe(Effect.flatMap(coalescedResult =>
            coalescedResult
              ? Effect.succeed(coalescedResult)
              : Effect.promise(async () => {
                  const baseline = request.webhook
                    ? await reconciliationObserver.measure(
                        'load-source-baseline',
                        loadSourceBaseline,
                        value => ({
                          recordCount: value.records.length,
                          sourceCount: value.sourceRevisions.length,
                        }),
                      )
                    : undefined;

                  return reconciliationObserver.measure(
                    'load-projection-input',
                    () => input.loadProjection(request, baseline, reconciliationObserver),
                    value => ({
                      evidenceFailureCount: value.evidenceFailures.length,
                      incremental: Boolean(value.sourceChangeSet),
                      recordCount: value.records.length,
                      sourceCount: value.sourceRevisions.length,
                    }),
                  );
                }).pipe(
              Effect.flatMap(projection =>
                Effect.promise(async () => {
                  const checkpoint = await reconciliationObserver.measure(
                    'hydrate-materialization-checkpoint',
                    () => parsedRecordMaterializationStore.load({
                      derivationId: ATLAS_PARSED_RECORD_MATERIALIZER_ID,
                      scopeId: ATLAS_PARSED_RECORD_MATERIALIZATION_SCOPE,
                    }),
                    value => ({
                      artifactCount: value?.artifacts.length ?? 0,
                      checkpointFound: Boolean(value),
                      dependencyCount: value?.dependencies.length ?? 0,
                    }),
                  );
                  const materialization = await reconciliationObserver.measure(
                    'materialize-parsed-records',
                    () => materializeAtlasParsedRecords({
                      changeSet: projection.sourceChangeSet,
                      initial: checkpoint,
                      parseRecord: input.parseRecordArtifact,
                      records: projection.records,
                      sourceRevisions: projection.sourceRevisions,
                    }),
                    value => ({
                      artifactCount: value.artifacts.length,
                      fallbackReason: value.fallbackReason,
                      mode: value.mode,
                      parsedRecordCount: value.parsedRecordCount,
                      reusedRecordCount: value.reusedRecordCount,
                    }),
                  );

                  const observedPullRequests = mergeWebhookPullRequestObservation(
                    projection,
                    request,
                  );
                  const evidenceCheckpoint = await evidenceMaterializationStore.load({
                    derivationId: ATLAS_PULL_REQUEST_EVIDENCE_MATERIALIZER_ID,
                    scopeId: ATLAS_PARSED_RECORD_MATERIALIZATION_SCOPE,
                  });
                  const materializePullRequestEvidence = createAtlasPullRequestEvidenceMaterializer(
                    evidenceCheckpoint?.snapshot,
                  );
                  const pullRequestEvidence = await reconciliationObserver.measure(
                    'resolve-pull-request-evidence',
                    () =>
                      materializePullRequestEvidence(
                        materialization.source,
                        observedPullRequests,
                        projection.acceptedPullRequestEvidence ?? [],
                      ),
                    value => ({
                      bindingCount: value.evidence.bindings.length,
                      derivedPullRequestCount: value.derivedPullRequestCount,
                      mode: value.mode,
                    }),
                  );

                  return {
                    expectedMaterializationSourceFrontier:
                      checkpoint?.snapshot.acceptance.sourceFrontier ?? null,
                    expectedEvidenceFrontier:
                      evidenceCheckpoint?.snapshot.acceptance.sourceFrontier ?? null,
                    materialization,
                    observedPullRequests,
                    projection,
                    pullRequestEvidence,
                  };
                }),
              ),
              Effect.flatMap(({
                expectedMaterializationSourceFrontier,
                expectedEvidenceFrontier,
                materialization,
                observedPullRequests,
                projection,
                pullRequestEvidence,
              }) => {
        const catchUpSince =
          request.trigger === 'catch-up'
            ? requireCatchUpSince(request.catchUpSince)
            : null;

        if (request.trigger === 'catch-up' && projection.evidenceFailures.length > 0) {
          return Effect.die(
            new Error(
              `Atlas catch-up requires all evidence sources; ${projection.evidenceFailures.length} source observation(s) failed.`,
            ),
          );
        }

        const dataset = reconciliationObserver.measureSync(
          'assemble-projection-dataset',
          () => {
            const assembled = buildAtlasOntahiDatasetFromSource(
              materialization.source,
              projection.records,
              observedPullRequests,
              projection.sourceRevisions,
              projection.observedReleases ?? [],
              reconciliationObserver.measureSync,
              pullRequestEvidence.evidence,
            );
            reconciliationObserver.measureSync('validate-projection-identities', () =>
              assertAtlasProjectionIdentities(assembled),
            );
            return assembled;
          },
          value => ({
            itemCount: value.AtlasItem.length,
            planCount: value.AtlasPlan.length,
            sourceRecordCount: value.AtlasSourceRecord.length,
          }),
        );
        const projectionRevisionId = `projection:${randomUUID()}`;
        const startedAt = projection.observedAt;
        const sourceRevisionSetHash = hashRevisionSet(
          dataset.AtlasSourceRevision.map(revision => revision.id),
        );
        const currentItemIds = new Set(dataset.AtlasItem.map(item => item.id));
        const currentPlanIds = new Set(dataset.AtlasPlan.map(plan => plan.id));
        const currentSourceRecordIds = new Set(dataset.AtlasSourceRecord.map(record => record.id));
        const currentSnapshotJson = dataset.ProjectionRevision[0]?.snapshotJson ?? '{}';
        const diagnostics = {
          catchUpSince: catchUpSince?.iso ?? null,
          evidenceFailures: projection.evidenceFailures,
          parsedRecordMaterialization: {
            artifactCount: materialization.artifacts.length,
            fallbackReason: materialization.fallbackReason,
            mode: materialization.mode,
            parsedRecordCount: materialization.parsedRecordCount,
            reusedRecordCount: materialization.reusedRecordCount,
          },
          pullRequestEvidenceMaterialization: {
            derivedPullRequestCount: pullRequestEvidence.derivedPullRequestCount,
            mode: pullRequestEvidence.mode,
          },
          sourceChangeSetId: projection.sourceChangeSet?.id ?? null,
        };
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

        const finishPublicationObservation = reconciliationObserver.start(
          'publish-projection-revision',
        );
        const publicationStartedAt = performance.now();
        const publicationTimings: Record<string, number> = {};
        let wouldSkipPublication: boolean | null = null;
        let publicationStageStartedAt = publicationStartedAt;
        const markPublicationStage = (field: string) => {
          const now = performance.now();
          publicationTimings[field] = Math.round((now - publicationStageStartedAt) * 100) / 100;
          publicationStageStartedAt = now;
        };
        return atlas.application.app.graph.transaction(
          Effect.gen(function* () {
            markPublicationStage('transactionEntryMs');
            yield* entities.ProjectionReconciliationLock.upsert(
              {
                id: 'atlas-projection',
                processingToken: reconciliationToken,
                acquiredAt: startedAt,
              },
              { conflictOn: ['id'], strategy: 'merge' },
            ).run();

            markPublicationStage('lockWriteMs');
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
              .select(revision => ({
                id: revision.id,
                diagnosticsJson: revision.diagnosticsJson,
                startedAt: revision.startedAt,
              }))
              .orderBy(revision => revision.startedAt.desc())
              .limit(1)
              .run();
            const latestRevision = latestRevisions[0];
            if (
              projection.incrementalBaselineProjectionRevisionId &&
              latestRevision?.id !== projection.incrementalBaselineProjectionRevisionId
            ) {
              return yield* Effect.die(
                new Error(
                  'Atlas incremental source baseline changed before publication; retry reconciliation.',
                ),
              );
            }
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

            const previousSnapshots =
              projection.evidenceFailures.length > 0 && latestRevision
                ? yield* entities.ProjectionRevision.where(revision =>
                    revision.id.eq(latestRevision.id),
                  )
                    .select(revision => ({ snapshotJson: revision.snapshotJson }))
                    .limit(1)
                    .run()
                : [];

            const { evidenceBindingCount, snapshotJson } = retainEvidenceFromFailedSources({
              currentSnapshotJson,
              failures: projection.evidenceFailures,
              previousSnapshotJson: previousSnapshots[0]?.snapshotJson,
            });

            markPublicationStage('admissionAndEvidenceRetentionMs');
            for (const sourceId of projection.evidenceSourceIds) {
              yield* entities.EvidenceBinding.where(binding => binding.sourceId.eq(sourceId))
                .delete()
                .run();
            }
            markPublicationStage('clearEvidenceBindingsMs');
            yield* entities.AtlasShapingBinding.all().delete().run();
            yield* entities.AtlasSupportBinding.all().delete().run();
            yield* entities.AtlasTypeBinding.all().delete().run();
            yield* entities.AtlasPlanRelationBinding.all().delete().run();

            if (dataset.AtlasSourceRevision.length > 0) {
              yield* entities.AtlasSourceRevision.upsertMany(dataset.AtlasSourceRevision, {
                conflictOn: ['id'],
                strategy: 'merge',
              }).run();
            }
            if (projection.sourceChangeSet) {
              const changeSet = projection.sourceChangeSet;
              const sourceId = String(changeSet.source.locator.id);
              yield* entities.AtlasSourceChangeSet.upsert(
                {
                  id: changeSet.id,
                  sourceId,
                  baseSourceRevisionId: `${sourceId}:markdown:${changeSet.baseRevision.revisionKey}`,
                  targetSourceRevisionId: `${sourceId}:markdown:${changeSet.targetRevision.revisionKey}`,
                  operationCount: changeSet.operations.length,
                  operationsJson: JSON.stringify(changeSet.operations),
                  provenanceJson: JSON.stringify(changeSet.provenance),
                  provider: changeSet.provenance.provider,
                  providerDeliveryId: changeSet.provenance.providerDeliveryId,
                  unitOfWorkId: changeSet.attribution.unitOfWorkId,
                  sessionId: changeSet.attribution.sessionId,
                  principalId: changeSet.attribution.principalId,
                  observedAt: changeSet.provenance.observedAt,
                },
                { conflictOn: ['id'], strategy: 'ignore' },
              ).run();
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
            if (dataset.AtlasTypeBinding.length > 0) {
              yield* entities.AtlasTypeBinding.upsertMany(dataset.AtlasTypeBinding, {
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

            markPublicationStage('writeProjectionEntitiesMs');
            const workspaceSources = yield* entities.AtlasWorkspaceSource.all()
              .select(source => ({
                id: source.id,
                sourceId: source.sourceId,
                workspaceId: source.workspaceId,
              }))
              .run();
            const githubAccounts = yield* entities.AtlasAuthAccount.where(account =>
              account.providerId.eq('github'),
            )
              .select(account => ({ accountId: account.accountId, userId: account.userId }))
              .run();
            const successfulSources = workspaceSources.filter(source =>
              projection.evidenceSourceIds.includes(source.sourceId),
            );
            const contributors = deriveWorkspaceContributors({
              linkedUserIdByGithubAccountId: new Map(
                githubAccounts.map(account => [account.accountId, account.userId]),
              ),
              pullRequests: observedPullRequests,
              sources: successfulSources,
            });
            for (const source of successfulSources) {
              yield* entities.AtlasWorkspaceContributor.where(contributor =>
                contributor.workspaceSourceId.eq(source.id),
              )
                .delete()
                .run();
            }
            if (contributors.length > 0) {
              yield* entities.AtlasWorkspaceContributor.insertMany(contributors).run();
            }
            markPublicationStage('writeWorkspaceContributorsMs');
            // A degraded publication can retain graph rows that are absent from the candidate.
            const fingerprintProjectionContent = () => {
              const { generatedAt: _generatedAt, ...snapshot } = JSON.parse(
                snapshotJson,
              ) as PlanWorkstreamSnapshot;
              return createHash('sha256')
                .update('atlas-projection-content-v1\0')
                .update(JSON.stringify(snapshot))
                .update('\0')
                .update(JSON.stringify({
                  sourceRevisions: dataset.AtlasSourceRevision.map(
                    ({ observedAt: _observedAt, ...revision }) => revision,
                  ),
                  sourceRecords: dataset.AtlasSourceRecord.map(
                    ({ content: _content, ...record }) => record,
                  ),
                  items: dataset.AtlasItem,
                  plans: dataset.AtlasPlan,
                  shapingBindings: dataset.AtlasShapingBinding,
                  supportBindings: dataset.AtlasSupportBinding,
                  typeBindings: dataset.AtlasTypeBinding,
                  planRelationBindings: dataset.AtlasPlanRelationBinding,
                  pullRequests: dataset.PullRequest,
                  evidenceBindings: dataset.EvidenceBinding,
                  evidenceSourceIds: projection.evidenceSourceIds,
                  contributorScope: successfulSources.map(source => source.id),
                  contributors,
                }))
                .digest('hex');
            };
            const publicationFingerprint =
              projection.evidenceFailures.length === 0 ? fingerprintProjectionContent() : null;
            const previousFingerprint: unknown = latestRevision
              ? JSON.parse(latestRevision.diagnosticsJson)?.publicationFingerprint
              : null;
            if (publicationFingerprint && typeof previousFingerprint === 'string') {
              wouldSkipPublication = publicationFingerprint === previousFingerprint;
            }
            markPublicationStage('comparePublicationContentMs');
            if (dataset.EvidenceBinding.length > 0) {
              yield* entities.EvidenceBinding.upsertMany(dataset.EvidenceBinding, {
                conflictOn: ['id'],
                strategy: 'merge',
              }).run();
            }

            markPublicationStage('writeEvidenceBindingsMs');
            if (request.trigger === 'catch-up') {
              const catchUpPullRequests = [...projection.observedPullRequests]
                .filter(
                  pullRequest =>
                    Date.parse(pullRequest.mergedAt) >= catchUpSince!.timestamp,
                )
                .sort((left, right) => left.mergedAt.localeCompare(right.mergedAt));

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

            markPublicationStage('recordMergeActivityMs');
            const completedAt = new Date().toISOString();
            yield* entities.ProjectionRevision.insert({
              id: projectionRevisionId,
              trigger: request.trigger,
              sourceRevisionSetHash,
              snapshotJson,
              diagnosticsJson: JSON.stringify({
                ...diagnostics,
                publicationFingerprint,
                wouldSkipPublication,
              }),
              startedAt,
              completedAt,
              status: projection.evidenceFailures.length > 0 ? 'degraded' : 'completed',
            }).run();
            markPublicationStage('insertProjectionSnapshotMs');
            if (projection.sourceChangeSet) {
              yield* entities.AtlasSourceChangeSetApplication.upsert(
                {
                  id: `source-change-set-application:${projection.sourceChangeSet.id}`,
                  changeSetId: projection.sourceChangeSet.id,
                  projectionRevisionId,
                  status: 'applied',
                  appliedAt: completedAt,
                  diagnosticsJson: '{}',
                },
                { conflictOn: ['changeSetId'], strategy: 'ignore' },
              ).run();
            }
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

            markPublicationStage('writePublicationMetadataMs');
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
        ).pipe(
          Effect.tap(result =>
            Effect.sync(() => {
              if (result.projectionRevisionId === projectionRevisionId) {
                markPublicationStage('transactionExitMs');
              }
              finishPublicationObservation('completed', {
                ...publicationTimings,
                wouldSkipPublication,
                published: result.projectionRevisionId === projectionRevisionId,
                evidenceBindingCount: result.evidenceBindingCount,
                itemCount: result.itemCount,
                planCount: result.planCount,
                sourceCount: result.sourceCount,
              });
            }),
          ),
          Effect.tapError(() =>
            Effect.sync(() => finishPublicationObservation('failed')),
          ),
          Effect.tap(result =>
            result.projectionRevisionId === projectionRevisionId &&
            pullRequestEvidence.mode !== 'reused'
              ? Effect.promise(async () => {
                  try {
                    await reconciliationObserver.measure(
                      'persist-pull-request-evidence-checkpoint',
                      () => evidenceMaterializationStore.replace({
                        checkpoint: {
                          artifacts: [],
                          dependencies: [],
                          scopeId: ATLAS_PARSED_RECORD_MATERIALIZATION_SCOPE,
                          snapshot: pullRequestEvidence.checkpoint,
                          updatedAt: startedAt,
                        },
                        expectedSourceFrontier: expectedEvidenceFrontier,
                      }),
                      value => ({ writeStatus: value.status }),
                    );
                  } catch (error) {
                    console.error('Atlas projection published without advancing its evidence checkpoint.', error);
                  }
                })
              : Effect.void,
          ),
          Effect.tap(result =>
            result.projectionRevisionId === projectionRevisionId
              ? Effect.promise(async () => {
                  try {
                    const write = await reconciliationObserver.measure(
                      'persist-materialization-checkpoint',
                      () => parsedRecordMaterializationStore.replace({
                        checkpoint: {
                          artifacts: materialization.artifacts,
                          dependencies: materialization.dependencies,
                          scopeId: ATLAS_PARSED_RECORD_MATERIALIZATION_SCOPE,
                          snapshot: materialization.snapshot,
                          updatedAt: new Date().toISOString(),
                        },
                        expectedSourceFrontier: expectedMaterializationSourceFrontier,
                      }),
                      value => ({
                        artifactCount: materialization.artifacts.length,
                        dependencyCount: materialization.dependencies.length,
                        writeStatus: value.status,
                      }),
                    );

                    if (write.status === 'conflict') {
                      console.error('Atlas parsed-record checkpoint advanced concurrently.', {
                        currentSourceFrontier: write.currentSourceFrontier,
                        expectedSourceFrontier: expectedMaterializationSourceFrontier,
                      });
                    }
                  } catch (error) {
                    console.error(
                      'Atlas projection published without advancing its parsed-record checkpoint.',
                      error,
                    );
                  }
                })
              : Effect.void,
          ),
        );
              }),
              Effect.map(result => ({
                invalidatePresentation: !result.duplicate,
                result,
                workspaceFanOut: !result.duplicate,
              } satisfies ReconciliationExecution)),
            ),
          )),
      ),
      Effect.tap(execution =>
        request.webhook && execution.workspaceFanOut
          ? reconcileWorkspaceWebhook(request.webhook)
          : Effect.void,
      ),
      Effect.tap(execution =>
        execution.invalidatePresentation
          ? Effect.sync(() => {
              projectionSnapshotCache.invalidate();
              pageProjectionSnapshotCache.invalidate();
              input.invalidatePresentation?.();
            })
          : Effect.void,
      ),
      Effect.map(execution => execution.result),
      Effect.orDie,
    );
  };

  const invokeReconciliationOperation = async (request: AtlasReconciliationRequest) => {
    if (request.trigger === 'webhook' || request.webhook) {
      throw new Error('Webhook reconciliation must enter through its Ontahi ingress operation.');
    }

    const result = await atlas.application.invokeOperation(
      entities.ProjectionRevision.domain.reconcile,
      {
        catchUpSince: request.catchUpSince ?? null,
        trigger: request.trigger,
      },
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
    getPageProjectionSnapshot: pageProjectionSnapshotCache.read,
    getWorkspacePageProjection: readWorkspacePageProjection,
    getWorkspacePageProjectionSnapshot: async (workspaceId: string) =>
      (await readWorkspacePageProjection(workspaceId))?.snapshot ?? null,
    getProjectionNodeContent,
    getProjectionSnapshot: projectionSnapshotCache.read,
    previewMergeCatchUp: (previewInput: { since: string }) =>
      withAtlasPostgresQueryContext(
        { operation: 'atlas.projection.catch-up-preview', trigger: 'catch-up' },
        () => previewMergeCatchUp(previewInput),
      ),
    reconcile: (request: AtlasReconciliationRequest) =>
      withAtlasPostgresQueryContext(
        { operation: 'atlas.projection.reconcile', trigger: request.trigger },
        () => invokeReconciliationOperation(request),
      ),
  };
};
