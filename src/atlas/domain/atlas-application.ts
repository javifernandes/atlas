import path from 'node:path';

import {
  createInMemoryDataGraphStorage,
  field,
  graphSchema,
  query,
  type InMemoryDataset,
} from '@ontahi/core/data-graph';
import {
  entity,
  ontahi,
  relation,
  semanticEntityRef,
  type OntahiCapabilities,
} from '@ontahi/core/runtime/server';

import {
  parseAtlasSourceRecords,
  type ParsedAtlasItem,
  type ParsedPlan,
  type ParsedAtlasSource,
} from '../markdown/build-snapshot';
import type { AtlasObservedPullRequest } from '../github/pull-request-evidence';
import type { NormalizedAtlasSourceRecord } from '../sources/normalized-source';
import {
  proposePlanLink,
  type AtlasPlanLinkProposal,
} from './plan-link-proposal';

type AtlasCapabilities = OntahiCapabilities & {
  runtime: {
    evidence: {
      invalidateRepository(repositoryFullName: string): void;
    };
    proposals: {
      linkPlanToItem(input: {
        itemSemanticId: string;
        planPath: string;
      }): AtlasPlanLinkProposal;
    };
  };
};

const atlasItemFields = {
  id: field.id(),
  semanticId: field.nonEmptyString({ trim: true }),
  title: field.nonEmptyString({ trim: true }),
  kind: field.nonEmptyString({ trim: true }),
  status: field.nonEmptyString({ trim: true }),
  parentId: field.nullable(field.id()),
};

const atlasPlanFields = {
  id: field.id(),
  path: field.nonEmptyString({ trim: true }),
  title: field.nonEmptyString({ trim: true }),
  status: field.nonEmptyString({ trim: true }),
  parentPlanId: field.nullable(field.id()),
};

const shapingBindingFields = {
  id: field.id(),
  itemId: field.id(),
  planId: field.id(),
};

const supportBindingFields = {
  id: field.id(),
  sourceItemId: field.id(),
  targetItemId: field.id(),
};

const planRelationBindingFields = {
  id: field.id(),
  sourcePlanId: field.id(),
  targetPlanId: field.id(),
  kind: field.enum(['follow-up', 'related']),
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
  invalidated: field.boolean(),
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

export const AtlasPlan = entity({
  name: 'AtlasPlan',
  fields: atlasPlanFields,
  relations: {
    parent: relation.belongsTo(AtlasPlanRef, { via: 'parentPlanId' }),
    children: relation.hasMany(AtlasPlanRef, { via: 'parentPlanId' }),
  },
});

export const AtlasShapingBinding = entity({
  name: 'AtlasShapingBinding',
  fields: shapingBindingFields,
  relations: {
    item: relation.belongsTo(AtlasItemRef, { via: 'itemId' }),
    plan: relation.belongsTo(AtlasPlan, { via: 'planId' }),
  },
});

export const AtlasSupportBinding = entity({
  name: 'AtlasSupportBinding',
  fields: supportBindingFields,
  relations: {
    source: relation.belongsTo(AtlasItemRef, { via: 'sourceItemId' }),
    target: relation.belongsTo(AtlasItemRef, { via: 'targetItemId' }),
  },
});

export const AtlasPlanRelationBinding = entity({
  name: 'AtlasPlanRelationBinding',
  fields: planRelationBindingFields,
  relations: {
    source: relation.belongsTo(AtlasPlan, { via: 'sourcePlanId' }),
    target: relation.belongsTo(AtlasPlan, { via: 'targetPlanId' }),
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
        app.runtime.evidence.invalidateRepository(input.repositoryFullName);

        return {
          invalidated: true,
          repositoryFullName: input.repositoryFullName,
        };
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
  },
  operations: ({ self, entities, operation, app }) => ({
    proposePlanLink: operation({
      input: graphSchema.object({
        item: graphSchema.existingRef(self),
        plan: graphSchema.existingRef(entities.AtlasPlan),
      }),
      output: AtlasPlanLinkProposalSchema,
      *run({ item, plan }) {
        const { after: _after, before: _before, ...proposal } =
          app.runtime.proposals.linkPlanToItem({
            itemSemanticId: item.semanticId,
            planPath: plan.path,
          });

        return proposal;
      },
    }),
  }),
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

const buildAtlasOntahiDatasetFromSource = (
  { items, plans }: ParsedAtlasSource,
  observedPullRequests: AtlasObservedPullRequest[] = [],
): InMemoryDataset => {
  const planByPath = new Map(plans.map(plan => [plan.path, plan]));
  const itemBySemanticId = new Map(items.map(item => [item.id, item]));
  const resolvedEvidence = resolvePullRequestEvidence(
    { items, plans },
    observedPullRequests,
  );

  return {
    AtlasItem: items.map(item => ({
      id: item.nodeId,
      semanticId: item.id,
      title: item.title,
      kind: item.kind,
      status: item.status,
      parentId: item.parent ? `atlas:${item.parent}` : null,
    })),
    AtlasPlan: plans.map(plan => ({
      id: plan.id,
      path: plan.path,
      title: plan.title,
      status: plan.status,
      parentPlanId: plan.parentPlanPath
        ? (planByPath.get(plan.parentPlanPath)?.id ?? null)
        : null,
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
      title: pullRequest.title,
      url: pullRequest.url,
    })),
    EvidenceBinding: resolvedEvidence.bindings,
  };
};

export const buildAtlasOntahiDataset = (
  records: NormalizedAtlasSourceRecord[],
  observedPullRequests: AtlasObservedPullRequest[] = [],
): InMemoryDataset =>
  buildAtlasOntahiDatasetFromSource(parseAtlasSourceRecords(records), observedPullRequests);

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

export const createAtlasOntahiApplication = (
  records: NormalizedAtlasSourceRecord[],
  options: {
    invalidateRepository?: (repositoryFullName: string) => void;
    observedPullRequests?: AtlasObservedPullRequest[];
  } = {},
) => {
  const source = parseAtlasSourceRecords(records);
  const storage = createInMemoryDataGraphStorage({
    dataset: buildAtlasOntahiDatasetFromSource(source, options.observedPullRequests),
  });
  const application = ontahi({
    storage,
    capabilities: {
      runtime: {
        evidence: {
          invalidateRepository: options.invalidateRepository ?? (() => undefined),
        },
        proposals: {
          linkPlanToItem: (input: { itemSemanticId: string; planPath: string }) =>
            proposePlanLink(source, input),
        },
      },
    },
    entities: [
      AtlasItem,
      AtlasPlan,
      AtlasShapingBinding,
      AtlasSupportBinding,
      AtlasPlanRelationBinding,
      PullRequest,
      EvidenceBinding,
    ],
  });

  return {
    application,
    getItemContext: (semanticId: string): Promise<AtlasItemContext | null> =>
      application.graph.read(atlasItemContextQuery(semanticId), {
        scope: 'atlas.item-context',
      }),
    getItemContexts: async (): Promise<Record<string, AtlasItemContext | null>> =>
      Object.fromEntries(
        await Promise.all(
          source.items.map(
            async item =>
              [
                item.id,
                await application.graph.read(atlasItemContextQuery(item.id), {
                  scope: 'atlas.item-context-index',
                }),
              ] as const,
          ),
        ),
      ),
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
