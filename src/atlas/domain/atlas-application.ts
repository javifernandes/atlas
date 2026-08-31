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
  runServerEffect,
  semanticEntityRef,
} from '@ontahi/core/runtime/server';

import type { PlanWorkstreamSnapshot } from '../model/snapshot';

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

const isAtlasItemNode = (
  node: PlanWorkstreamSnapshot['nodes'][number],
): node is PlanWorkstreamSnapshot['nodes'][number] & { semanticId: string } =>
  Boolean(node.semanticId) && node.kind !== 'plan';

const isAtlasPlanNode = (
  node: PlanWorkstreamSnapshot['nodes'][number],
): node is PlanWorkstreamSnapshot['nodes'][number] & { path: string } =>
  node.kind === 'plan' && Boolean(node.path);

export const buildAtlasOntahiDataset = (snapshot: PlanWorkstreamSnapshot): InMemoryDataset => {
  const atlasItemNodes = snapshot.nodes.filter(isAtlasItemNode);
  const atlasPlanNodes = snapshot.nodes.filter(isAtlasPlanNode);
  const atlasItemIds = new Set(atlasItemNodes.map(node => node.id));
  const atlasPlanIds = new Set(atlasPlanNodes.map(node => node.id));
  const parentByItemId = new Map(
    snapshot.edges
      .filter(
        edge =>
          edge.kind === 'contains' &&
          atlasItemIds.has(edge.from) &&
          atlasItemIds.has(edge.to),
      )
      .map(edge => [edge.to, edge.from]),
  );

  return {
    AtlasItem: atlasItemNodes.map(node => ({
      id: node.id,
      semanticId: node.semanticId,
      title: node.title,
      kind: node.kind,
      status: node.status,
      parentId: parentByItemId.get(node.id) ?? null,
    })),
    AtlasPlan: atlasPlanNodes.map(node => ({
      id: node.id,
      path: node.path,
      title: node.title,
      status: node.status,
    })),
    AtlasShapingBinding: snapshot.edges
      .filter(
        edge =>
          edge.kind === 'shaped-by' &&
          atlasItemIds.has(edge.from) &&
          atlasPlanIds.has(edge.to),
      )
      .map(edge => ({ id: edge.id, itemId: edge.from, planId: edge.to })),
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
    }));

export type AtlasItemContext = {
  id: string;
  semanticId: string;
  title: string;
  kind: string;
  status: string;
  parent: { id: string; semanticId: string; title: string } | null;
  children: Array<{ id: string; semanticId: string; title: string }>;
  shapingBindings: Array<{
    plan: { id: string; path: string; title: string; status: string };
  }>;
};

export const createAtlasOntahiApplication = (snapshot: PlanWorkstreamSnapshot) => {
  const storage = createInMemoryDataGraphStorage({ dataset: buildAtlasOntahiDataset(snapshot) });
  const application = ontahi({
    storage,
    entities: [AtlasItem, AtlasPlan, AtlasShapingBinding],
  });

  return {
    application,
    getItemContext: (semanticId: string) =>
      runServerEffect(
        application.app.graph.getViewEffect(atlasItemContextQuery(semanticId), undefined),
        {
          scope: 'atlas.item-context',
          concerns: [application.app.graph.withRuntime()],
        },
      ) as Promise<AtlasItemContext | null>,
  };
};
