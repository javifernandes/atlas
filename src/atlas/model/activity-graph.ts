export const activityNodeKinds = [
  'stimulus',
  'activity',
  'decision',
  'merge',
  'operation',
  'interaction',
  'outcome',
] as const;

export type ActivityNodeKind = (typeof activityNodeKinds)[number];

const activityNodeKindSet = new Set<string>(activityNodeKinds);

export const isActivityNodeKind = (value: string): value is ActivityNodeKind =>
  activityNodeKindSet.has(value);

export type ActivityResponsibility = 'actor' | 'system' | 'external';

export type ActivitySemanticReference = {
  label?: string;
  reference: string;
  resolution?: 'resolved' | 'unresolved';
  targetNodeId?: string;
};

export type ActivityNode = {
  id: string;
  kind: ActivityNodeKind;
  label: string;
  actor?: string;
  responsibility?: ActivityResponsibility;
  reads: ActivitySemanticReference[];
  presents: ActivitySemanticReference[];
  reference?: ActivitySemanticReference;
};

export type ActivityTransition = {
  from: string;
  to: string;
  guard?: string;
  trigger?: string;
  affordance?: string;
  result?: string;
};

export type ActivityGraph = {
  entry: string;
  nodes: ActivityNode[];
  transitions: ActivityTransition[];
};

export type ActivityGraphDiagnosticCode =
  | 'duplicate-node-id'
  | 'missing-entry'
  | 'missing-entry-node'
  | 'dangling-transition'
  | 'unreachable-node'
  | 'missing-semantic-reference';

export type ActivityGraphDiagnostic = {
  code: ActivityGraphDiagnosticCode;
  message: string;
  path?: string;
  severity: 'error' | 'warning';
};

export const validateActivityGraph = (graph: ActivityGraph): ActivityGraphDiagnostic[] => {
  const diagnostics: ActivityGraphDiagnostic[] = [];
  const nodeIds = new Set<string>();

  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      diagnostics.push({
        code: 'duplicate-node-id',
        message: `Activity node ID ${node.id} is declared more than once.`,
        path: `nodes.${node.id}`,
        severity: 'error',
      });
    }
    nodeIds.add(node.id);

    if ((node.kind === 'operation' || node.kind === 'interaction') && !node.reference) {
      diagnostics.push({
        code: 'missing-semantic-reference',
        message: `${node.kind} node ${node.id} must reference an authored ${node.kind}.`,
        path: `nodes.${node.id}.ref`,
        severity: 'error',
      });
    }
  }

  if (!graph.entry) {
    diagnostics.push({
      code: 'missing-entry',
      message: 'Activity Graph must declare one entry node ID.',
      path: 'entry',
      severity: 'error',
    });
  } else if (!nodeIds.has(graph.entry)) {
    diagnostics.push({
      code: 'missing-entry-node',
      message: `Activity entry ${graph.entry} does not identify an authored node.`,
      path: 'entry',
      severity: 'error',
    });
  }

  for (const [index, transition] of graph.transitions.entries()) {
    for (const endpoint of ['from', 'to'] as const) {
      if (!nodeIds.has(transition[endpoint])) {
        diagnostics.push({
          code: 'dangling-transition',
          message: `Transition ${endpoint} endpoint ${transition[endpoint]} does not identify an authored node.`,
          path: `transitions.${index}.${endpoint}`,
          severity: 'error',
        });
      }
    }
  }

  if (nodeIds.has(graph.entry)) {
    const reachable = new Set([graph.entry]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const transition of graph.transitions) {
        if (reachable.has(transition.from) && nodeIds.has(transition.to)) {
          const size = reachable.size;
          reachable.add(transition.to);
          changed ||= reachable.size !== size;
        }
      }
    }

    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) {
        diagnostics.push({
          code: 'unreachable-node',
          message: `Activity node ${node.id} is unreachable from entry ${graph.entry}.`,
          path: `nodes.${node.id}`,
          severity: 'warning',
        });
      }
    }
  }

  return diagnostics;
};
