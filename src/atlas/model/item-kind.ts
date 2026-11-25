import type { EntityModel } from './snapshot';
import type { ActivityGraph } from './activity-graph';

export const atlasItemKinds = [
  'item',
  'collection',
  'project',
  'package',
  'goal',
  'entity',
  'operation',
  'interaction',
  'artifact',
] as const;

export type AtlasItemKind = (typeof atlasItemKinds)[number];

export const legacyAtlasItemKindAliases = {
  capability: 'item',
  concept: 'item',
  evidence: 'collection',
  experience: 'item',
  model: 'collection',
  policy: 'item',
  practice: 'item',
  principle: 'item',
  relation: 'item',
  state: 'item',
  'system-primitive': 'item',
  territory: 'collection',
  tooling: 'item',
} as const satisfies Record<string, AtlasItemKind>;

export type LegacyAtlasItemKind = keyof typeof legacyAtlasItemKindAliases;

const atlasItemKindSet = new Set<string>(atlasItemKinds);

export const isAtlasItemKind = (value: string): value is AtlasItemKind =>
  atlasItemKindSet.has(value);

export const normalizeAtlasItemKind = (value: string): AtlasItemKind | undefined =>
  isAtlasItemKind(value)
    ? value
    : legacyAtlasItemKindAliases[value as LegacyAtlasItemKind];

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

export type OperationRealizationReference = {
  namespace: string;
  kind: string;
  target: string;
  status?: string;
};

export type OperationInvariantReference = {
  rule: string;
  ownerReference?: string;
  reference?: string;
  resolution?: 'resolved' | 'unresolved';
  targetNodeId?: string;
  constraint?: string;
};

export type OperationItemModel = {
  kind: 'operation';
  receiver?: string;
  actor?: string;
  inputsAndOutput?: string;
  availability?: string;
  transitionAndEffects?: string;
  failures?: string[];
  invariantsPreserved?: OperationInvariantReference[];
  realizationRefs: OperationRealizationReference[];
};

export type InteractionReference = {
  label: string;
  reference?: string;
  resolution?: 'resolved' | 'unresolved';
  targetNodeId?: string;
};
export type InteractionItemModel = {
  kind: 'interaction';
  activity?: ActivityGraph;
  scope: { entity: string; binding: string };
  goal: string;
  actors: Array<{ actor: string; participation: string }>;
  context: string[];
  presents: Array<{
    information: string;
    source: string;
    atStep?: string;
    reference?: string;
    resolution?: 'resolved' | 'unresolved';
    targetNodeId?: string;
  }>;
  affordances: Array<
    InteractionReference & { affordanceKind: string; atStep?: string; target?: string }
  >;
  steps: Array<
    InteractionReference & {
      actorAction?: string;
      externalSystems?: string;
      next: string[];
      rules?: string;
      stepKind: string;
      systemBehavior?: string;
    }
  >;
  outcomes: Array<{
    outcome: string;
    meaning: string;
    fromStep?: string;
    continuesWith?: string;
    continuationResolution?: 'resolved' | 'unresolved';
    continuationTargetNodeId?: string;
  }>;
};

export type AtlasItemModel =
  | PackageItemModel
  | EntityItemModel
  | OperationItemModel
  | InteractionItemModel;

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

export const getOperationItemModel = (node: ItemModelCarrier): OperationItemModel | undefined =>
  node.itemModel?.kind === 'operation' ? node.itemModel : undefined;

export const getInteractionItemModel = (node: ItemModelCarrier) =>
  node.itemModel?.kind === 'interaction' ? node.itemModel : undefined;
