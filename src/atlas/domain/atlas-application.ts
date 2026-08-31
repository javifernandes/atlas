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
  type ParsedAtlasSource,
} from '../markdown/build-snapshot';
import type { NormalizedAtlasSourceRecord } from '../sources/normalized-source';
import {
  proposePlanLink,
  type AtlasPlanLinkProposal,
} from './plan-link-proposal';

type AtlasCapabilities = OntahiCapabilities & {
  runtime: {
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

const buildAtlasOntahiDatasetFromSource = ({ items, plans }: ParsedAtlasSource): InMemoryDataset => {
  const planByPath = new Map(plans.map(plan => [plan.path, plan]));
  const itemBySemanticId = new Map(items.map(item => [item.id, item]));

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
  };
};

export const buildAtlasOntahiDataset = (
  records: NormalizedAtlasSourceRecord[],
): InMemoryDataset => buildAtlasOntahiDatasetFromSource(parseAtlasSourceRecords(records));

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

export const createAtlasOntahiApplication = (records: NormalizedAtlasSourceRecord[]) => {
  const source = parseAtlasSourceRecords(records);
  const storage = createInMemoryDataGraphStorage({
    dataset: buildAtlasOntahiDatasetFromSource(source),
  });
  const application = ontahi({
    storage,
    capabilities: {
      runtime: {
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
  };
};
