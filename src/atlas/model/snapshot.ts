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

export type PlanWorkstreamNode = {
  id: string;
  kind: PlanNodeKind;
  title: string;
  shortTitle: string;
  statusGroup: PlanStatusGroup;
  status: string;
  planKind?: string;
  scale?: string;
  horizon?: string;
  area?: string;
  codename?: string;
  semanticId?: string;
  territory: string;
  workstream?: string;
  path?: string;
  sourceFilePath?: string;
  href?: string;
  markdown?: string;
  summary?: string;
  sections: string[];
  exemplars?: string[];
  relatedCount: number;
  candidateCount: number;
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
