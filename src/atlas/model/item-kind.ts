import type { EntityModel } from './snapshot';

export const atlasItemKinds = [
  'project',
  'package',
  'goal',
  'territory',
  'model',
  'concept',
  'experience',
  'capability',
  'entity',
  'operation',
  'artifact',
  'policy',
  'state',
  'relation',
  'system-primitive',
  'tooling',
  'evidence',
  'practice',
  'principle',
] as const;

export type AtlasItemKind = (typeof atlasItemKinds)[number];

const atlasItemKindSet = new Set<string>(atlasItemKinds);

export const isAtlasItemKind = (value: string): value is AtlasItemKind =>
  atlasItemKindSet.has(value);

export type PackageItemModel = {
  kind: 'package';
  name?: string;
  packageType?: string;
  path: string;
};

export type EntityItemModel = {
  kind: 'entity';
  entity: EntityModel;
};

export type AtlasItemModel = PackageItemModel | EntityItemModel;

type ItemModelCarrier = {
  entityModel?: EntityModel;
  itemModel?: AtlasItemModel;
  kind: string;
  packageName?: string;
  packagePath?: string;
  packageType?: string;
};

export const getPackageItemModel = (node: ItemModelCarrier): PackageItemModel | undefined => {
  if (node.itemModel?.kind === 'package') return node.itemModel;

  if (node.kind !== 'package' || !node.packagePath) return undefined;

  return {
    kind: 'package',
    name: node.packageName,
    packageType: node.packageType,
    path: node.packagePath,
  };
};

export const getEntityItemModel = (node: ItemModelCarrier): EntityItemModel | undefined => {
  if (node.itemModel?.kind === 'entity') return node.itemModel;

  return node.kind === 'entity' && node.entityModel
    ? { entity: node.entityModel, kind: 'entity' }
    : undefined;
};
