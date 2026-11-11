export type PlanStatusGroup =
  | 'current'
  | 'next'
  | 'backlog'
  | 'research'
  | 'done'
  | 'unmaterialized';

export type PlanNodeKind =
  | 'root'
  | 'project'
  | 'package'
  | 'territory'
  | 'workstream'
  | 'model'
  | 'concept'
  | 'experience'
  | 'capability'
  | 'entity'
  | 'operation'
  | 'artifact'
  | 'policy'
  | 'state'
  | 'relation'
  | 'system-primitive'
  | 'tooling'
  | 'evidence'
  | 'practice'
  | 'principle'
  | 'plan'
  | 'candidate';

export type PlanRelationKind =
  | 'contains'
  | 'related'
  | 'candidate'
  | 'shaped-by'
  | 'supports'
  | 'follow-up';

export type EntityModelField = {
  name: string;
  type: string;
  required: boolean;
  meaning: string;
};

export type EntityModelRelation = {
  name: string;
  target: string;
  cardinality: string;
  meaning: string;
};

export type EntityModelState = {
  name: string;
  kind: 'initial' | 'active' | 'terminal' | string;
  meaning: string;
};

export type EntityModelOperation = {
  name: string;
  actor: string;
  appliesWhen: string;
  transition: string;
  effects: string;
};

export type EntityModelInvariant = {
  rule: string;
  constraint: string;
};

export type EntityModel = {
  fields: EntityModelField[];
  relations: EntityModelRelation[];
  states: EntityModelState[];
  operations: EntityModelOperation[];
  invariants: EntityModelInvariant[];
};

export type PlanWorkstreamNode = {
  id: string;
  kind: PlanNodeKind;
  title: string;
  shortTitle: string;
  statusGroup: PlanStatusGroup;
  status: string;
  planKey?: string;
  sourceId?: string;
  planKind?: string;
  scale?: string;
  horizon?: string;
  area?: string;
  codename?: string;
  packageName?: string;
  packageType?: string;
  packagePath?: string;
  semanticId?: string;
  territory: string;
  workstream?: string;
  path?: string;
  sourcePath?: string;
  sourceFilePath?: string;
  sourceRepository?: string;
  sourceRevision?: string;
  sourceRevisionKind?: 'git' | 'content-sha256';
  href?: string;
  markdown?: string;
  summary?: string;
  sections: string[];
  exemplars?: string[];
  entityModel?: EntityModel;
  relatedCount: number;
  candidateCount: number;
  inferredMentions?: PlanWorkstreamMention[];
};

export type PlanWorkstreamMention = {
  confidence: number;
  inference: 'exact-title';
  matchedText: string;
  targetNodeId: string;
};

export type PlanWorkstreamEdge = {
  id: string;
  from: string;
  to: string;
  kind: PlanRelationKind;
};

export type PlanWorkstreamTerritory = {
  id: string;
  title: string;
  nodeCount: number;
  activeCount: number;
};

export type PlanWorkstreamMetric = {
  label: string;
  value: string;
};

export type PlanWorkstreamEvidence = {
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

export type PlanWorkstreamSnapshot = {
  generatedAt: string;
  metrics: PlanWorkstreamMetric[];
  territories: PlanWorkstreamTerritory[];
  nodes: PlanWorkstreamNode[];
  documents?: PlanWorkstreamNode[];
  edges: PlanWorkstreamEdge[];
  evidence?: PlanWorkstreamEvidence[];
};
