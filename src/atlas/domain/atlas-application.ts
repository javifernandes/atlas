import {
  createInMemoryDataGraphStorage,
  field,
  query,
  type InMemoryDataset,
} from '@ontahi/core/data-graph';
import {
  entity,
  ontahi,
  relation,
  semanticEntityRef,
} from '@ontahi/core/runtime/server';

import { parseAtlasSourceRecords } from '../markdown/build-snapshot';
import type { NormalizedAtlasSourceRecord } from '../sources/normalized-source';

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
};

const shapingBindingFields = {
  id: field.id(),
  itemId: field.id(),
  planId: field.id(),
};

const AtlasItemRef = semanticEntityRef('AtlasItem', { fields: atlasItemFields });

export const AtlasPlan = entity({
  name: 'AtlasPlan',
  fields: atlasPlanFields,
});

export const AtlasShapingBinding = entity({
  name: 'AtlasShapingBinding',
  fields: shapingBindingFields,
  relations: {
    item: relation.belongsTo(AtlasItemRef, { via: 'itemId' }),
    plan: relation.belongsTo(AtlasPlan, { via: 'planId' }),
  },
});

export const AtlasItem = entity({
  name: 'AtlasItem',
  fields: atlasItemFields,
  relations: {
    parent: relation.belongsTo(AtlasItemRef, { via: 'parentId' }),
    children: relation.hasMany(AtlasItemRef, { via: 'parentId' }),
    shapingBindings: relation.hasMany(AtlasShapingBinding, { via: 'itemId' }),
  },
});

export const buildAtlasOntahiDataset = (
  records: NormalizedAtlasSourceRecord[],
): InMemoryDataset => {
  const { items, plans } = parseAtlasSourceRecords(records);
  const planByPath = new Map(plans.map(plan => [plan.path, plan]));

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
  };
};

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

export const createAtlasOntahiApplication = (records: NormalizedAtlasSourceRecord[]) => {
  const storage = createInMemoryDataGraphStorage({ dataset: buildAtlasOntahiDataset(records) });
  const application = ontahi({
    storage,
    entities: [AtlasItem, AtlasPlan, AtlasShapingBinding],
  });

  return {
    application,
    getItemContext: (semanticId: string): Promise<AtlasItemContext | null> =>
      application.graph.read(atlasItemContextQuery(semanticId), {
        scope: 'atlas.item-context',
      }),
  };
};
