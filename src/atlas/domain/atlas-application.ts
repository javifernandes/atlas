import { createHash } from 'node:crypto';
import path from 'node:path';

import {
  createInMemoryDataGraphStorage,
  type DataGraphDefaultStorage,
  field,
  graphSchema,
  query,
} from '@ontahi/core/data-graph';
import {
  entity,
  ontahi,
  relation,
  semanticEntityRef,
  type OntahiCapabilities,
} from '@ontahi/core/runtime/server';
import { Effect } from 'effect';

import {
  buildPlanWorkstreamSnapshotFromFiles,
  parseAtlasSourceRecords,
  type ParsedAtlasItem,
  type ParsedPlan,
  type ParsedAtlasSource,
} from '../markdown/build-snapshot';
import type { AtlasObservedPullRequest } from '../github/pull-request-evidence';
import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import type { NormalizedAtlasSourceRecord } from '../sources/normalized-source';
import type { AtlasLoadedSourceRevision } from '../sources/markdown-source';
import {
  proposePlanLink,
  type AtlasPlanLinkProposal,
} from './plan-link-proposal';

export type AtlasCapabilities = OntahiCapabilities & {
  runtime: {
    projection: {
      reconcile(input: AtlasReconciliationRequest): Effect.Effect<AtlasReconciliationResult>;
    };
    proposals: {
      linkPlanToItem(input: {
        itemSemanticId: string;
        planPath: string;
      }): Effect.Effect<AtlasPlanLinkProposal>;
    };
  };
};

export type AtlasMergedPullRequestInput = {
  authorLogin: string | null;
  body: string | null;
  deliveryId: string | null;
  installationId: string;
  mergeCommitSha: string | null;
  mergedAt: string;
  number: number;
  repositoryFullName: string;
  title: string;
  url: string;
};

export type AtlasRepositoryPushInput = {
  after: string;
  before: string;
  deliveryId: string | null;
  installationId: string;
  ref: string;
  repositoryFullName: string;
};

export type AtlasReconciliationTrigger = 'bootstrap' | 'manual' | 'rebuild' | 'webhook';

export type AtlasReconciliationRequest = {
  trigger: AtlasReconciliationTrigger;
  webhook?: AtlasMergedPullRequestInput | AtlasRepositoryPushInput;
};

export type AtlasReconciliationResult = {
  duplicate: boolean;
  evidenceBindingCount: number;
  invalidated: boolean;
  itemCount: number;
  planCount: number;
  projectionRevisionId: string;
  repositoryFullName: string | null;
  sourceCount: number;
};

const sourceRevisionFields = {
  id: field.id(),
  sourceId: field.nonEmptyString({ trim: true }),
  repository: field.nullable(field.string()),
  authority: field.enum(['markdown', 'github']),
  revision: field.nonEmptyString({ trim: true }),
  revisionKind: field.enum(['git', 'content-sha256']),
  observedAt: field.nonEmptyString({ trim: true }),
};

const sourceRecordFields = {
  id: field.id(),
  canonicalPath: field.nonEmptyString({ trim: true }),
  sourceId: field.nonEmptyString({ trim: true }),
  sourceRevisionId: field.id(),
  sourcePath: field.nonEmptyString({ trim: true }),
  sourceFilePath: field.nullable(field.string()),
  recordKind: field.enum(['item', 'plan', 'other']),
  content: field.string(),
  contentHash: field.nonEmptyString({ trim: true }),
};

const atlasItemFields = {
  id: field.id(),
  semanticId: field.nonEmptyString({ trim: true }),
  title: field.nonEmptyString({ trim: true }),
  kind: field.nonEmptyString({ trim: true }),
  status: field.nonEmptyString({ trim: true }),
  parentId: field.nullable(field.id()),
  sourceId: field.nonEmptyString({ trim: true }),
  sourceRevisionId: field.id(),
  sourceRecordId: field.id(),
};

const atlasPlanFields = {
  id: field.id(),
  path: field.nonEmptyString({ trim: true }),
  title: field.nonEmptyString({ trim: true }),
  status: field.nonEmptyString({ trim: true }),
  parentPlanId: field.nullable(field.id()),
  sourceId: field.nonEmptyString({ trim: true }),
  sourceRevisionId: field.id(),
  sourceRecordId: field.id(),
};

const shapingBindingFields = {
  id: field.id(),
  itemId: field.id(),
  planId: field.id(),
  sourceId: field.nonEmptyString({ trim: true }),
  sourceRevisionId: field.id(),
  sourceRecordId: field.id(),
};

const supportBindingFields = {
  id: field.id(),
  sourceItemId: field.id(),
  targetItemId: field.id(),
  sourceId: field.nonEmptyString({ trim: true }),
  sourceRevisionId: field.id(),
  sourceRecordId: field.id(),
};

const planRelationBindingFields = {
  id: field.id(),
  sourcePlanId: field.id(),
  targetPlanId: field.id(),
  kind: field.enum(['follow-up', 'related']),
  sourceId: field.nonEmptyString({ trim: true }),
  sourceRevisionId: field.id(),
  sourceRecordId: field.id(),
};

const pullRequestFields = {
  id: field.id(),
  authorAvatarUrl: field.nullable(field.string()),
  authorLogin: field.nullable(field.string()),
  mergeCommitSha: field.nullable(field.string()),
  mergedByAvatarUrl: field.nullable(field.string()),
  mergedByLogin: field.nullable(field.string()),
  mergedAt: field.nonEmptyString({ trim: true }),
  number: field.number(),
  repositoryFullName: field.nonEmptyString({ trim: true }),
  sourceId: field.nonEmptyString({ trim: true }),
  sourceAuthority: field.enum(['github']),
  sourceRevision: field.nonEmptyString({ trim: true }),
  observedAt: field.nonEmptyString({ trim: true }),
  title: field.nonEmptyString({ trim: true }),
  url: field.nonEmptyString({ trim: true }),
};

const evidenceBindingFields = {
  id: field.id(),
  pullRequestId: field.id(),
  itemId: field.nullable(field.id()),
  planId: field.nullable(field.id()),
  targetNodeId: field.nonEmptyString({ trim: true }),
  targetKind: field.enum(['item', 'plan']),
  kind: field.enum(['implements', 'shapes']),
  provenance: field.enum(['explicit']),
  sourceId: field.nonEmptyString({ trim: true }),
  sourceAuthority: field.enum(['github']),
  sourceRevision: field.nonEmptyString({ trim: true }),
};

const projectionRevisionFields = {
  id: field.id(),
  trigger: field.enum(['bootstrap', 'manual', 'rebuild', 'webhook']),
  sourceRevisionSetHash: field.nonEmptyString({ trim: true }),
  snapshotJson: field.string(),
  diagnosticsJson: field.string(),
  startedAt: field.nonEmptyString({ trim: true }),
  completedAt: field.nonEmptyString({ trim: true }),
  status: field.enum(['completed', 'degraded']),
};

const projectionSourceRevisionFields = {
  id: field.id(),
  projectionRevisionId: field.id(),
  sourceRevisionId: field.id(),
  sourceId: field.nonEmptyString({ trim: true }),
};

const projectionReconciliationLockFields = {
  id: field.id(),
  processingToken: field.nonEmptyString({ trim: true }),
  acquiredAt: field.nonEmptyString({ trim: true }),
};

const webhookDeliveryFields = {
  id: field.id(),
  provider: field.enum(['github']),
  event: field.nonEmptyString({ trim: true }),
  sourceId: field.nullable(field.string()),
  sourceRevision: field.nullable(field.string()),
  repositoryFullName: field.nonEmptyString({ trim: true }),
  processingToken: field.nonEmptyString({ trim: true }),
  receivedAt: field.nonEmptyString({ trim: true }),
  processedAt: field.nullable(field.string()),
  projectionRevisionId: field.nullable(field.id()),
};

const MergedPullRequestInputSchema = graphSchema.object({
  authorLogin: graphSchema.nullable(field.string()),
  body: graphSchema.nullable(field.string()),
  deliveryId: graphSchema.nullable(field.string()),
  installationId: field.nonEmptyString({ trim: true }),
  mergeCommitSha: graphSchema.nullable(field.string()),
  mergedAt: field.nonEmptyString({ trim: true }),
  number: field.number(),
  repositoryFullName: field.nonEmptyString({ trim: true }),
  title: field.nonEmptyString({ trim: true }),
  url: field.nonEmptyString({ trim: true }),
});

const MergedPullRequestOutputSchema = graphSchema.value('MergedPullRequestRefresh', {
  duplicate: field.boolean(),
  evidenceBindingCount: field.number(),
  invalidated: field.boolean(),
  itemCount: field.number(),
  planCount: field.number(),
  projectionRevisionId: field.nonEmptyString({ trim: true }),
  repositoryFullName: graphSchema.nullable(field.string()),
  sourceCount: field.number(),
});

const ReconcileProjectionInputSchema = graphSchema.object({
  trigger: field.enum(['bootstrap', 'manual', 'rebuild']),
});

const RepositoryPushInputSchema = graphSchema.object({
  after: field.nonEmptyString({ trim: true }),
  before: field.nonEmptyString({ trim: true }),
  deliveryId: graphSchema.nullable(field.string()),
  installationId: field.nonEmptyString({ trim: true }),
  ref: field.nonEmptyString({ trim: true }),
  repositoryFullName: field.nonEmptyString({ trim: true }),
});

const AtlasPlanLinkProposalSchema = graphSchema.value('AtlasPlanLinkProposal', {
  itemSemanticId: field.nonEmptyString({ trim: true }),
  patch: field.string(),
  planPath: field.nonEmptyString({ trim: true }),
  planReference: field.nonEmptyString({ trim: true }),
  sourceId: field.nonEmptyString({ trim: true }),
  sourcePath: field.nonEmptyString({ trim: true }),
  status: field.enum(['already-linked', 'proposed']),
});

const AtlasItemRef = semanticEntityRef('AtlasItem', { fields: atlasItemFields });
const AtlasPlanRef = semanticEntityRef('AtlasPlan', { fields: atlasPlanFields });
const EvidenceBindingRef = semanticEntityRef('EvidenceBinding', { fields: evidenceBindingFields });
const SourceRevisionRef = semanticEntityRef('AtlasSourceRevision', {
  fields: sourceRevisionFields,
});
const SourceRecordRef = semanticEntityRef('AtlasSourceRecord', { fields: sourceRecordFields });
const ProjectionRevisionRef = semanticEntityRef('ProjectionRevision', {
  fields: projectionRevisionFields,
});

export const AtlasSourceRevision = entity({
  name: 'AtlasSourceRevision',
  fields: sourceRevisionFields,
});

export const AtlasSourceRecord = entity({
  name: 'AtlasSourceRecord',
  fields: sourceRecordFields,
  relations: {
    revision: relation.belongsTo(AtlasSourceRevision, { via: 'sourceRevisionId' }),
  },
});

export const AtlasPlan = entity({
  name: 'AtlasPlan',
  fields: atlasPlanFields,
  relations: {
    parent: relation.belongsTo(AtlasPlanRef, { via: 'parentPlanId' }),
    children: relation.hasMany(AtlasPlanRef, { via: 'parentPlanId' }),
    sourceRevision: relation.belongsTo(SourceRevisionRef, { via: 'sourceRevisionId' }),
    sourceRecord: relation.belongsTo(SourceRecordRef, { via: 'sourceRecordId' }),
  },
});

export const AtlasShapingBinding = entity({
  name: 'AtlasShapingBinding',
  fields: shapingBindingFields,
  relations: {
    item: relation.belongsTo(AtlasItemRef, { via: 'itemId' }),
    plan: relation.belongsTo(AtlasPlan, { via: 'planId' }),
    sourceRevision: relation.belongsTo(SourceRevisionRef, { via: 'sourceRevisionId' }),
    sourceRecord: relation.belongsTo(SourceRecordRef, { via: 'sourceRecordId' }),
  },
});

export const AtlasSupportBinding = entity({
  name: 'AtlasSupportBinding',
  fields: supportBindingFields,
  relations: {
    source: relation.belongsTo(AtlasItemRef, { via: 'sourceItemId' }),
    target: relation.belongsTo(AtlasItemRef, { via: 'targetItemId' }),
    sourceRevision: relation.belongsTo(SourceRevisionRef, { via: 'sourceRevisionId' }),
    sourceRecord: relation.belongsTo(SourceRecordRef, { via: 'sourceRecordId' }),
  },
});

export const AtlasPlanRelationBinding = entity({
  name: 'AtlasPlanRelationBinding',
  fields: planRelationBindingFields,
  relations: {
    source: relation.belongsTo(AtlasPlan, { via: 'sourcePlanId' }),
    target: relation.belongsTo(AtlasPlan, { via: 'targetPlanId' }),
    sourceRevision: relation.belongsTo(SourceRevisionRef, { via: 'sourceRevisionId' }),
    sourceRecord: relation.belongsTo(SourceRecordRef, { via: 'sourceRecordId' }),
  },
});

export const PullRequest = entity({
  name: 'PullRequest',
  fields: pullRequestFields,
  domainOperationDefaults: {
    authority: 'server',
    exposure: 'server-only',
    layer: 'atlas.evidence',
  },
  uses: {
    capabilities: {} as AtlasCapabilities,
  },
  relations: {
    evidenceBindings: relation.hasMany(EvidenceBindingRef, { via: 'pullRequestId' }),
  },
  operations: ({ operation, ingress, app }) => ({
    refreshAfterMerge: operation({
      description: 'Invalidate Atlas source and PR evidence after a merged GitHub pull request',
      input: MergedPullRequestInputSchema,
      output: MergedPullRequestOutputSchema,
      ingress: [
        ingress.http({
          method: 'POST',
          route: '/api/ingress/github/webhook',
          provider: 'github-webhook',
          channel: 'source-control.pull-request.merged',
        }),
      ],
      *run(input) {
        return yield* app.runtime.projection.reconcile({
          trigger: 'webhook',
          webhook: input,
        });
      },
    }),
  }),
});

export const EvidenceBinding = entity({
  name: 'EvidenceBinding',
  fields: evidenceBindingFields,
  relations: {
    item: relation.belongsTo(AtlasItemRef, { via: 'itemId' }),
    plan: relation.belongsTo(AtlasPlan, { via: 'planId' }),
    pullRequest: relation.belongsTo(PullRequest, { via: 'pullRequestId' }),
  },
});

export const AtlasItem = entity({
  name: 'AtlasItem',
  fields: atlasItemFields,
  domainOperationDefaults: {
    authority: 'server',
    exposure: 'bridge',
    layer: 'atlas',
  },
  uses: {
    capabilities: {} as AtlasCapabilities,
    entities: { AtlasPlan },
  },
  relations: {
    parent: relation.belongsTo(AtlasItemRef, { via: 'parentId' }),
    children: relation.hasMany(AtlasItemRef, { via: 'parentId' }),
    shapingBindings: relation.hasMany(AtlasShapingBinding, { via: 'itemId' }),
    outgoingSupportBindings: relation.hasMany(AtlasSupportBinding, { via: 'sourceItemId' }),
    incomingSupportBindings: relation.hasMany(AtlasSupportBinding, { via: 'targetItemId' }),
    sourceRevision: relation.belongsTo(SourceRevisionRef, { via: 'sourceRevisionId' }),
    sourceRecord: relation.belongsTo(SourceRecordRef, { via: 'sourceRecordId' }),
  },
  operations: ({ self, entities, operation, app }) => ({
    proposePlanLink: operation({
      input: graphSchema.object({
        item: graphSchema.existingRef(self),
        plan: graphSchema.existingRef(entities.AtlasPlan),
      }),
      output: AtlasPlanLinkProposalSchema,
      *run({ item, plan }) {
        const { after: _after, before: _before, ...proposal } = yield*
          app.runtime.proposals.linkPlanToItem({
            itemSemanticId: item.semanticId,
            planPath: plan.path,
          });

        return proposal;
      },
    }),
  }),
});

export const ProjectionRevision = entity({
  name: 'ProjectionRevision',
  fields: projectionRevisionFields,
  domainOperationDefaults: {
    authority: 'server',
    exposure: 'server-only',
    layer: 'atlas.projection',
  },
  uses: {
    capabilities: {} as AtlasCapabilities,
  },
  operations: ({ operation, ingress, app }) => ({
    reconcile: operation({
      description: 'Reconcile registered Atlas authorities into the durable projection',
      input: ReconcileProjectionInputSchema,
      output: MergedPullRequestOutputSchema,
      *run(input) {
        return yield* app.runtime.projection.reconcile(input);
      },
    }),
    refreshAfterPush: operation({
      description: 'Reconcile Atlas sources after a signed repository push',
      input: RepositoryPushInputSchema,
      output: MergedPullRequestOutputSchema,
      ingress: [
        ingress.http({
          method: 'POST',
          route: '/api/ingress/github/webhook',
          provider: 'github-webhook',
          channel: 'source-control.repository.pushed',
        }),
      ],
      *run(input) {
        return yield* app.runtime.projection.reconcile({
          trigger: 'webhook',
          webhook: input,
        });
      },
    }),
  }),
});

export const ProjectionSourceRevision = entity({
  name: 'ProjectionSourceRevision',
  fields: projectionSourceRevisionFields,
  relations: {
    projectionRevision: relation.belongsTo(ProjectionRevisionRef, {
      via: 'projectionRevisionId',
    }),
    sourceRevision: relation.belongsTo(SourceRevisionRef, { via: 'sourceRevisionId' }),
  },
});

export const ProjectionReconciliationLock = entity({
  name: 'ProjectionReconciliationLock',
  fields: projectionReconciliationLockFields,
});

export const WebhookDelivery = entity({
  name: 'WebhookDelivery',
  fields: webhookDeliveryFields,
  relations: {
    projectionRevision: relation.belongsTo(ProjectionRevisionRef, {
      via: 'projectionRevisionId',
    }),
  },
});

const resolvePlanTarget = (
  reference: string,
  sourceId: string,
  planByPath: Map<string, ParsedPlan>,
) => {
  const cleanReference = reference.trim().replace(/^`|`$/g, '');
  const sourceRelativePlan = cleanReference.startsWith('plans/')
    ? `${sourceId}://plans/${path.posix.basename(cleanReference, '.md')}`
    : !cleanReference.includes('://') && /^\d+[a-z]?(?:-|$)/i.test(cleanReference)
      ? `${sourceId}://plans/${cleanReference.replace(/\.md$/, '')}`
      : null;
  const planBySourceKey = [...planByPath.values()].find(
    plan => plan.sourceId === sourceId && plan.key.toLowerCase() === cleanReference.toLowerCase(),
  );

  return planByPath.get(cleanReference) ??
    (sourceRelativePlan ? planByPath.get(sourceRelativePlan) : undefined) ??
    planBySourceKey;
};

const resolveItemTarget = (
  reference: string,
  itemByReference: Map<string, ParsedAtlasItem>,
) => itemByReference.get(reference.trim().replace(/^`|`$/g, ''));

const resolvePullRequestEvidence = (
  source: ParsedAtlasSource,
  observedPullRequests: AtlasObservedPullRequest[],
) => {
  const planByPath = new Map(source.plans.map(plan => [plan.path, plan]));
  const itemByReference = new Map(
    source.items.flatMap(item => [
      [item.id, item] as const,
      [item.path, item] as const,
    ]),
  );
  const bindings = [
    ...new Map(
      observedPullRequests
        .flatMap(pullRequest =>
          pullRequest.directives.flatMap(directive => {
            const plan = resolvePlanTarget(directive.target, pullRequest.sourceId, planByPath);
            const item = resolveItemTarget(directive.target, itemByReference);
            const target = plan
              ? { nodeId: plan.id, kind: 'plan' as const }
              : item
                ? { nodeId: item.nodeId, kind: 'item' as const }
                : null;

            if (!target) {
              return [];
            }

            const id = `${pullRequest.id}->${target.nodeId}:${directive.kind}`;

            return [
              {
                id,
                pullRequestId: pullRequest.id,
                itemId: target.kind === 'item' ? target.nodeId : null,
                planId: target.kind === 'plan' ? target.nodeId : null,
                targetNodeId: target.nodeId,
                targetKind: target.kind,
                kind: directive.kind,
                provenance: 'explicit' as const,
              },
            ];
          }),
        )
        .map(binding => [binding.id, binding] as const),
    ).values(),
  ];
  const linkedPullRequestIds = new Set(bindings.map(binding => binding.pullRequestId));

  return {
    bindings,
    pullRequests: observedPullRequests.filter(pullRequest =>
      linkedPullRequestIds.has(pullRequest.id),
    ),
  };
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const sourceIdForRecord = (record: NormalizedAtlasSourceRecord) =>
  record.sourceId ?? 'atlas';

const buildInMemorySourceRevisions = (records: NormalizedAtlasSourceRecord[]) => {
  const recordsBySource = new Map<string, NormalizedAtlasSourceRecord[]>();

  for (const record of records) {
    const sourceId = sourceIdForRecord(record);
    recordsBySource.set(sourceId, [...(recordsBySource.get(sourceId) ?? []), record]);
  }

  return [...recordsBySource].map(([sourceId, sourceRecords]) => {
    const revision = sha256(
      sourceRecords
        .sort((left, right) => left.canonicalPath.localeCompare(right.canonicalPath))
        .map(record => `${record.canonicalPath}\0${record.content}`)
        .join('\0'),
    );

    return {
      id: `${sourceId}:markdown:${revision}`,
      sourceId,
      repository: null,
      authority: 'markdown' as const,
      revision,
      revisionKind: 'content-sha256' as const,
      observedAt: '1970-01-01T00:00:00.000Z',
    };
  });
};

const sourceRecordKind = (record: NormalizedAtlasSourceRecord) =>
  record.sourcePath.startsWith('atlas/items/')
    ? ('item' as const)
    : record.sourcePath.startsWith('plans/')
      ? ('plan' as const)
      : ('other' as const);

const buildAtlasOntahiDatasetFromSource = (
  { items, plans }: ParsedAtlasSource,
  records: NormalizedAtlasSourceRecord[],
  observedPullRequests: AtlasObservedPullRequest[] = [],
  loadedSourceRevisions?: AtlasLoadedSourceRevision[],
) => {
  const planByPath = new Map(plans.map(plan => [plan.path, plan]));
  const itemBySemanticId = new Map(items.map(item => [item.id, item]));
  const resolvedEvidence = resolvePullRequestEvidence(
    { items, plans },
    observedPullRequests,
  );
  const sourceRevisions = loadedSourceRevisions ?? buildInMemorySourceRevisions(records);
  const sourceRevisionBySourceId = new Map(
    sourceRevisions.map(revision => [revision.sourceId, revision]),
  );
  const sourceRecords = records.map(record => {
    const sourceId = sourceIdForRecord(record);
    const sourceRevision = sourceRevisionBySourceId.get(sourceId);

    if (!sourceRevision) {
      throw new Error(`Atlas source ${sourceId} has no observed revision.`);
    }

    return {
      id: `source-record:${sourceId}:${record.sourcePath}`,
      canonicalPath: record.canonicalPath,
      sourceId,
      sourceRevisionId: sourceRevision.id,
      sourcePath: record.sourcePath,
      sourceFilePath: record.sourceFilePath ?? null,
      recordKind: sourceRecordKind(record),
      content: record.content,
      contentHash: sha256(record.content),
    };
  });
  const sourceRecordBySourcePath = new Map(
    sourceRecords.map(record => [`${record.sourceId}\0${record.sourcePath}`, record]),
  );
  const sourceMetadataFor = (sourcePath: string, sourceId: string | undefined) => {
    const normalizedSourceId = sourceId ?? 'atlas';
    const sourceRevision = sourceRevisionBySourceId.get(normalizedSourceId);
    const sourceRecord = sourceRecordBySourcePath.get(
      `${normalizedSourceId}\0${sourcePath}`,
    );

    if (!sourceRevision || !sourceRecord) {
      throw new Error(`Atlas record ${sourcePath} has incomplete source provenance.`);
    }

    return {
      sourceId: normalizedSourceId,
      sourceRevisionId: sourceRevision.id,
      sourceRecordId: sourceRecord.id,
    };
  };
  const sourceFiles = records.map(record => ({
    path: record.sourcePath,
    content: record.content,
    source: sourceIdForRecord(record),
  }));
  const snapshot = buildPlanWorkstreamSnapshotFromFiles(
    sourceFiles.filter(file => file.path.startsWith('plans/')),
    sourceFiles.filter(file => file.path.startsWith('atlas/items/')),
  );
  const sourceRevisionSetHash = sha256(
    sourceRevisions
      .map(revision => revision.id)
      .sort((left, right) => left.localeCompare(right))
      .join('\0'),
  );
  const projectionRevisionId = `projection:in-memory:${sourceRevisionSetHash}`;

  const dataset = {
    AtlasSourceRevision: sourceRevisions,
    AtlasSourceRecord: sourceRecords,
    AtlasItem: items.map(item => ({
      id: item.nodeId,
      semanticId: item.id,
      title: item.title,
      kind: item.kind,
      status: item.status,
      parentId: item.parent ? `atlas:${item.parent}` : null,
      ...sourceMetadataFor(item.sourcePath, item.sourceId),
    })),
    AtlasPlan: plans.map(plan => ({
      id: plan.id,
      path: plan.path,
      title: plan.title,
      status: plan.status,
      parentPlanId: plan.parentPlanPath
        ? (planByPath.get(plan.parentPlanPath)?.id ?? null)
        : null,
      ...sourceMetadataFor(plan.sourcePath, plan.sourceId),
    })),
    AtlasShapingBinding: items.flatMap(item =>
      item.relatedPlans.flatMap(planPath => {
        const plan = planByPath.get(planPath);

        return plan
          ? [
              {
                id: `${item.nodeId}->${plan.id}:shaped-by`,
                itemId: item.nodeId,
                planId: plan.id,
                ...sourceMetadataFor(item.sourcePath, item.sourceId),
              },
            ]
          : [];
      }),
    ),
    AtlasSupportBinding: items.flatMap(item =>
      item.supports.flatMap(targetSemanticId => {
        const target = itemBySemanticId.get(targetSemanticId);

        return target && target.id !== item.id
          ? [
              {
                id: `${item.nodeId}->${target.nodeId}:supports`,
                sourceItemId: item.nodeId,
                targetItemId: target.nodeId,
                ...sourceMetadataFor(item.sourcePath, item.sourceId),
              },
            ]
          : [];
      }),
    ),
    AtlasPlanRelationBinding: plans.flatMap(plan =>
      plan.relatedLinks.flatMap(link => {
        const target = planByPath.get(link.path);

        return target && target.id !== plan.id
          ? [
              {
                id: `${plan.id}->${target.id}:${link.kind}`,
                sourcePlanId: plan.id,
                targetPlanId: target.id,
                kind: link.kind,
                ...sourceMetadataFor(plan.sourcePath, plan.sourceId),
              },
            ]
          : [];
      }),
    ),
    PullRequest: resolvedEvidence.pullRequests.map(pullRequest => ({
      id: pullRequest.id,
      authorAvatarUrl: pullRequest.authorAvatarUrl,
      authorLogin: pullRequest.authorLogin,
      mergeCommitSha: pullRequest.mergeCommitSha,
      mergedByAvatarUrl: pullRequest.mergedByAvatarUrl,
      mergedByLogin: pullRequest.mergedByLogin,
      mergedAt: pullRequest.mergedAt,
      number: pullRequest.number,
      repositoryFullName: pullRequest.repositoryFullName,
      sourceId: pullRequest.sourceId,
      sourceAuthority: 'github' as const,
      sourceRevision: pullRequest.mergeCommitSha ?? pullRequest.mergedAt,
      observedAt: pullRequest.mergedAt,
      title: pullRequest.title,
      url: pullRequest.url,
    })),
    EvidenceBinding: resolvedEvidence.bindings.map(binding => {
      const pullRequest = resolvedEvidence.pullRequests.find(
        candidate => candidate.id === binding.pullRequestId,
      );

      if (!pullRequest) {
        throw new Error(`Evidence binding ${binding.id} has no Pull Request source.`);
      }

      return {
        ...binding,
        sourceId: pullRequest.sourceId,
        sourceAuthority: 'github' as const,
        sourceRevision: pullRequest.mergeCommitSha ?? pullRequest.mergedAt,
      };
    }),
    ProjectionRevision: [
      {
        id: projectionRevisionId,
        trigger: 'bootstrap',
        sourceRevisionSetHash,
        snapshotJson: JSON.stringify(snapshot),
        diagnosticsJson: '{}',
        startedAt: '1970-01-01T00:00:00.000Z',
        completedAt: '1970-01-01T00:00:00.000Z',
        status: 'completed' as const,
      },
    ],
    ProjectionSourceRevision: sourceRevisions.map(revision => ({
      id: `${projectionRevisionId}:${revision.id}`,
      projectionRevisionId,
      sourceRevisionId: revision.id,
      sourceId: revision.sourceId,
    })),
    ProjectionReconciliationLock: [],
    WebhookDelivery: [],
  };
  const pullRequestById = new Map(
    dataset.PullRequest.map(pullRequest => [pullRequest.id, pullRequest] as const),
  );
  const evidence = dataset.EvidenceBinding.flatMap(binding => {
    const pullRequest = pullRequestById.get(binding.pullRequestId);

    return pullRequest
      ? [
          {
            id: binding.id,
            kind: binding.kind,
            provenance: binding.provenance,
            targetNodeId: binding.targetNodeId,
            pullRequest: {
              authorAvatarUrl: pullRequest.authorAvatarUrl,
              authorLogin: pullRequest.authorLogin,
              mergeCommitSha: pullRequest.mergeCommitSha,
              mergedByAvatarUrl: pullRequest.mergedByAvatarUrl,
              mergedByLogin: pullRequest.mergedByLogin,
              mergedAt: pullRequest.mergedAt,
              number: pullRequest.number,
              repositoryFullName: pullRequest.repositoryFullName,
              title: pullRequest.title,
              url: pullRequest.url,
            },
          },
        ]
      : [];
  });
  dataset.ProjectionRevision[0]!.snapshotJson = JSON.stringify({
    ...snapshot,
    edges: projectAtlasTopology({
      items: dataset.AtlasItem,
      plans: dataset.AtlasPlan,
      shapingBindings: dataset.AtlasShapingBinding,
      supportBindings: dataset.AtlasSupportBinding,
      planRelationBindings: dataset.AtlasPlanRelationBinding,
    }),
    evidence,
  });

  return dataset;
};

export const buildAtlasOntahiDataset = (
  records: NormalizedAtlasSourceRecord[],
  observedPullRequests: AtlasObservedPullRequest[] = [],
  loadedSourceRevisions?: AtlasLoadedSourceRevision[],
) =>
  buildAtlasOntahiDatasetFromSource(
    parseAtlasSourceRecords(records),
    records,
    observedPullRequests,
    loadedSourceRevisions,
  );

const atlasItemContextQuery = (semanticId: string) =>
  query(AtlasItem)
    .where(item => item.semanticId.eq(semanticId))
    .select(item => ({
      id: item.id,
      semanticId: item.semanticId,
      title: item.title,
      kind: item.kind,
      status: item.status,
      parent: item.parent.select(parent => ({
        id: parent.id,
        semanticId: parent.semanticId,
        title: parent.title,
      })),
      children: item.children
        .select(child => ({
          id: child.id,
          semanticId: child.semanticId,
          title: child.title,
        }))
        .orderBy(child => child.title),
      shapingBindings: item.shapingBindings
        .select(binding => ({
          plan: binding.plan.select(plan => ({
            id: plan.id,
            path: plan.path,
            title: plan.title,
            status: plan.status,
          })),
        }))
        .orderBy(binding => binding.id),
    }))
    .first();

export type AtlasItemContext = {
  id: string;
  semanticId: string;
  title: string;
  kind: string;
  status: string;
  parent: { id: string; semanticId: string; title: string } | null;
  children: Array<{ id: string; semanticId: string; title: string }>;
  shapingBindings: Array<{
    plan: { id: string; path: string; title: string; status: string } | null;
  }>;
};

export type AtlasTopologyEdge = {
  id: string;
  from: string;
  to: string;
  kind: 'contains' | 'follow-up' | 'related' | 'shaped-by' | 'supports';
};

type AtlasTopologyRows = {
  items: Array<{ id: string; parentId: string | null }>;
  plans: Array<{ id: string; parentPlanId: string | null }>;
  shapingBindings: Array<{ id: string; itemId: string; planId: string }>;
  supportBindings: Array<{
    id: string;
    sourceItemId: string;
    targetItemId: string;
  }>;
  planRelationBindings: Array<{
    id: string;
    sourcePlanId: string;
    targetPlanId: string;
    kind: 'follow-up' | 'related';
  }>;
};

const rootNodeId = 'root:planning';

const hasContainmentPath = (
  descendantId: string,
  ancestorId: string,
  parentByItemId: Map<string, string | null>,
) => {
  const visited = new Set<string>();
  let currentId: string | null = descendantId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const parentId: string | null = parentByItemId.get(currentId) ?? null;

    if (parentId === ancestorId) {
      return true;
    }

    currentId = parentId;
  }

  return false;
};

export const projectAtlasTopology = ({
  items,
  plans,
  shapingBindings,
  supportBindings,
  planRelationBindings,
}: AtlasTopologyRows): AtlasTopologyEdge[] => {
  const itemIds = new Set(items.map(item => item.id));
  const parentByItemId = new Map(
    items.map(item => [item.id, item.parentId && itemIds.has(item.parentId) ? item.parentId : null]),
  );
  const referencedPlanIds = new Set(shapingBindings.map(binding => binding.planId));
  const visiblePlanIds = new Set(
    plans.filter(plan => referencedPlanIds.has(plan.id)).map(plan => plan.id),
  );
  const edges: AtlasTopologyEdge[] = [];
  const edgeIds = new Set<string>();
  const addEdge = (edge: AtlasTopologyEdge) => {
    if (!edgeIds.has(edge.id)) {
      edgeIds.add(edge.id);
      edges.push(edge);
    }
  };

  for (const item of items) {
    const parentId = parentByItemId.get(item.id) ?? null;
    addEdge({
      id: `${parentId ?? rootNodeId}->${item.id}:contains`,
      from: parentId ?? rootNodeId,
      to: item.id,
      kind: 'contains',
    });
  }

  for (const binding of shapingBindings) {
    const hiddenByDescendant = shapingBindings.some(
      candidate =>
        candidate.id !== binding.id &&
        candidate.planId === binding.planId &&
        hasContainmentPath(candidate.itemId, binding.itemId, parentByItemId),
    );

    if (!hiddenByDescendant && itemIds.has(binding.itemId) && visiblePlanIds.has(binding.planId)) {
      addEdge({
        id: binding.id,
        from: binding.itemId,
        to: binding.planId,
        kind: 'shaped-by',
      });
    }
  }

  for (const binding of supportBindings) {
    const isRedundant =
      hasContainmentPath(binding.sourceItemId, binding.targetItemId, parentByItemId) ||
      hasContainmentPath(binding.targetItemId, binding.sourceItemId, parentByItemId);

    if (
      !isRedundant &&
      itemIds.has(binding.sourceItemId) &&
      itemIds.has(binding.targetItemId)
    ) {
      addEdge({
        id: binding.id,
        from: binding.sourceItemId,
        to: binding.targetItemId,
        kind: 'supports',
      });
    }
  }

  for (const plan of plans) {
    if (
      visiblePlanIds.has(plan.id) &&
      plan.parentPlanId &&
      visiblePlanIds.has(plan.parentPlanId)
    ) {
      addEdge({
        id: `${plan.parentPlanId}->${plan.id}:contains`,
        from: plan.parentPlanId,
        to: plan.id,
        kind: 'contains',
      });
    }
  }

  for (const binding of planRelationBindings) {
    if (
      visiblePlanIds.has(binding.sourcePlanId) &&
      visiblePlanIds.has(binding.targetPlanId)
    ) {
      addEdge({
        id: binding.id,
        from: binding.sourcePlanId,
        to: binding.targetPlanId,
        kind: binding.kind,
      });
    }
  }

  return edges;
};

const atlasItemsTopologyQuery = query(AtlasItem).select(item => ({
  id: item.id,
  parentId: item.parentId,
}));

const atlasItemIndexQuery = query(AtlasItem)
  .select(item => ({ semanticId: item.semanticId }))
  .orderBy(item => item.semanticId);

const atlasPlansTopologyQuery = query(AtlasPlan).select(plan => ({
  id: plan.id,
  parentPlanId: plan.parentPlanId,
}));

const atlasShapingTopologyQuery = query(AtlasShapingBinding).select(binding => ({
  id: binding.id,
  itemId: binding.itemId,
  planId: binding.planId,
}));

const atlasSupportTopologyQuery = query(AtlasSupportBinding).select(binding => ({
  id: binding.id,
  sourceItemId: binding.sourceItemId,
  targetItemId: binding.targetItemId,
}));

const atlasPlanRelationsTopologyQuery = query(AtlasPlanRelationBinding).select(binding => ({
  id: binding.id,
  sourcePlanId: binding.sourcePlanId,
  targetPlanId: binding.targetPlanId,
  kind: binding.kind,
}));

const atlasEvidenceQuery = query(EvidenceBinding)
  .select(binding => ({
    id: binding.id,
    kind: binding.kind,
    provenance: binding.provenance,
    targetNodeId: binding.targetNodeId,
    pullRequest: binding.pullRequest.select(pullRequest => ({
      authorAvatarUrl: pullRequest.authorAvatarUrl,
      authorLogin: pullRequest.authorLogin,
      mergeCommitSha: pullRequest.mergeCommitSha,
      mergedByAvatarUrl: pullRequest.mergedByAvatarUrl,
      mergedByLogin: pullRequest.mergedByLogin,
      mergedAt: pullRequest.mergedAt,
      number: pullRequest.number,
      repositoryFullName: pullRequest.repositoryFullName,
      title: pullRequest.title,
      url: pullRequest.url,
    })),
  }))
  .orderBy(binding => binding.id);

const latestProjectionRevisionQuery = query(ProjectionRevision)
  .select(revision => ({
    id: revision.id,
    snapshotJson: revision.snapshotJson,
  }))
  .orderBy(revision => revision.startedAt.desc())
  .first();

const atlasSourceRecordsQuery = query(AtlasSourceRecord)
  .select(record => ({
    canonicalPath: record.canonicalPath,
    content: record.content,
    sourceFilePath: record.sourceFilePath,
    sourceId: record.sourceId,
    sourcePath: record.sourcePath,
  }))
  .orderBy(record => record.canonicalPath);

export type AtlasEvidenceProjection = {
  id: string;
  kind: 'implements' | 'shapes';
  provenance: 'explicit';
  targetNodeId: string;
  pullRequest: {
    authorAvatarUrl: string | null;
    authorLogin: string | null;
    mergeCommitSha: string | null;
    mergedByAvatarUrl: string | null;
    mergedByLogin: string | null;
    mergedAt: string;
    number: number;
    repositoryFullName: string;
    title: string;
    url: string;
  };
};

export const atlasEntities = [
  AtlasSourceRevision,
  AtlasSourceRecord,
  AtlasItem,
  AtlasPlan,
  AtlasShapingBinding,
  AtlasSupportBinding,
  AtlasPlanRelationBinding,
  PullRequest,
  EvidenceBinding,
  ProjectionRevision,
  ProjectionSourceRevision,
  ProjectionReconciliationLock,
  WebhookDelivery,
] as const;

const composeAtlasOntahiApplication = <TStorage extends DataGraphDefaultStorage>(input: {
  capabilities: AtlasCapabilities;
  storage: TStorage;
}) => {
  const application = ontahi({
    storage: input.storage,
    capabilities: input.capabilities,
    entities: atlasEntities,
  });

  return {
    application,
    getItemContext: (semanticId: string): Promise<AtlasItemContext | null> =>
      application.graph.read(atlasItemContextQuery(semanticId), {
        scope: 'atlas.item-context',
      }),
    getItemContexts: async (): Promise<Record<string, AtlasItemContext | null>> => {
      const items = await application.graph.read(atlasItemIndexQuery, {
        scope: 'atlas.item-context-index',
      });

      return Object.fromEntries(
        await Promise.all(
          items.map(
            async item =>
              [
                item.semanticId,
                await application.graph.read(atlasItemContextQuery(item.semanticId), {
                  scope: 'atlas.item-context-index',
                }),
              ] as const,
          ),
        ),
      );
    },
    getProjectionSnapshot: async (): Promise<PlanWorkstreamSnapshot | null> => {
      const revision = await application.graph.read(latestProjectionRevisionQuery, {
        scope: 'atlas.projection.latest',
      });

      if (!revision) {
        return null;
      }

      return JSON.parse(revision.snapshotJson) as PlanWorkstreamSnapshot;
    },
    getSourceRecords: async (): Promise<NormalizedAtlasSourceRecord[]> =>
      (await application.graph.read(atlasSourceRecordsQuery, {
        scope: 'atlas.source-records',
      })).map(record => ({
        canonicalPath: record.canonicalPath,
        content: record.content,
        sourceFilePath: record.sourceFilePath ?? undefined,
        sourceId: record.sourceId,
        sourcePath: record.sourcePath,
      })),
    getTopologyEdges: async (): Promise<AtlasTopologyEdge[]> => {
      const [items, plans, shapingBindings, supportBindings, planRelationBindings] =
        await Promise.all([
          application.graph.read(atlasItemsTopologyQuery, { scope: 'atlas.topology.items' }),
          application.graph.read(atlasPlansTopologyQuery, { scope: 'atlas.topology.plans' }),
          application.graph.read(atlasShapingTopologyQuery, {
            scope: 'atlas.topology.shaping-bindings',
          }),
          application.graph.read(atlasSupportTopologyQuery, {
            scope: 'atlas.topology.support-bindings',
          }),
          application.graph.read(atlasPlanRelationsTopologyQuery, {
            scope: 'atlas.topology.plan-relation-bindings',
          }),
        ]);

      return projectAtlasTopology({
        items,
        plans,
        shapingBindings,
        supportBindings,
        planRelationBindings,
      });
    },
    getEvidence: async (): Promise<AtlasEvidenceProjection[]> =>
      (await application.graph.read(atlasEvidenceQuery, {
        scope: 'atlas.evidence-bindings',
      })).flatMap(binding => {
        if (!binding.pullRequest) {
          return [];
        }

        return [
          {
            id: binding.id,
            kind: binding.kind,
            provenance: binding.provenance,
            targetNodeId: binding.targetNodeId,
            pullRequest: binding.pullRequest,
          },
        ];
      }),
  };
};

export const createAtlasOntahiApplicationWithStorage = <
  TStorage extends DataGraphDefaultStorage,
>(input: {
  capabilities: AtlasCapabilities;
  storage: TStorage;
}) => composeAtlasOntahiApplication(input);

export const createAtlasOntahiApplication = (
  records: NormalizedAtlasSourceRecord[],
  options: {
    invalidatePresentation?: () => void;
    invalidateRepository?: (repositoryFullName: string) => void;
    observedPullRequests?: AtlasObservedPullRequest[];
  } = {},
) => {
  const source = parseAtlasSourceRecords(records);
  const dataset = buildAtlasOntahiDatasetFromSource(
    source,
    records,
    options.observedPullRequests,
  );
  const storage = createInMemoryDataGraphStorage({
    dataset,
  });
  const projectionRevisionId = String(
    (dataset.ProjectionRevision as Array<{ id: string }> | undefined)?.[0]?.id ??
      'projection:in-memory:empty',
  );
  const application = composeAtlasOntahiApplication({
    storage,
    capabilities: {
      runtime: {
        projection: {
          reconcile: request =>
            Effect.sync(() => {
              if (request.webhook) {
                options.invalidateRepository?.(request.webhook.repositoryFullName);
              }
              options.invalidatePresentation?.();

              return {
                duplicate: false,
                evidenceBindingCount: (dataset.EvidenceBinding ?? []).length,
                invalidated: Boolean(request.webhook),
                itemCount: (dataset.AtlasItem ?? []).length,
                planCount: (dataset.AtlasPlan ?? []).length,
                projectionRevisionId,
                repositoryFullName: request.webhook?.repositoryFullName ?? null,
                sourceCount: (dataset.AtlasSourceRevision ?? []).length,
              };
            }),
        },
        proposals: {
          linkPlanToItem: (input: { itemSemanticId: string; planPath: string }) =>
            Effect.sync(() => proposePlanLink(source, input)),
        },
      },
    },
  });

  return application;
};
