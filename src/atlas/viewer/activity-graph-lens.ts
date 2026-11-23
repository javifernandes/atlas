import type {
  ActivityActorBinding,
  ActivityGraph,
  ActivityNode,
  ActivityTransition,
} from '../model/activity-graph';

export type ActivityGraphLensNode = ActivityNode & {
  actorBinding?: ActivityActorBinding;
  incoming: ActivityTransition[];
  isEntry: boolean;
  outgoing: ActivityTransition[];
};

export type ActivityGraphLensProjection = {
  backTransitions: ActivityTransition[];
  columns: Array<{ id: string; nodes: ActivityGraphLensNode[] }>;
  entry?: ActivityGraphLensNode;
  nodes: ActivityGraphLensNode[];
  transitions: ActivityTransition[];
};

export const buildActivityGraphLensProjection = (
  graph: ActivityGraph,
): ActivityGraphLensProjection => {
  const actorsById = new Map(graph.actors.map(actor => [actor.id, actor]));
  const nodes = graph.nodes.map<ActivityGraphLensNode>(node => ({
    ...node,
    ...(node.actor && actorsById.get(node.actor)
      ? { actorBinding: actorsById.get(node.actor) }
      : {}),
    incoming: graph.transitions.filter(transition => transition.to === node.id),
    isEntry: node.id === graph.entry,
    outgoing: graph.transitions.filter(transition => transition.from === node.id),
  }));
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const backTransitions = new Set<ActivityTransition>();

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);

    for (const transition of nodesById.get(nodeId)?.outgoing ?? []) {
      if (visiting.has(transition.to)) backTransitions.add(transition);
      else visit(transition.to);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  if (nodesById.has(graph.entry)) visit(graph.entry);
  for (const node of nodes) visit(node.id);

  const forwardTransitions = graph.transitions.filter(transition => !backTransitions.has(transition));
  const indegree = new Map(nodes.map(node => [node.id, 0]));
  for (const transition of forwardTransitions) {
    indegree.set(transition.to, (indegree.get(transition.to) ?? 0) + 1);
  }

  const queue = nodes.filter(node => indegree.get(node.id) === 0).map(node => node.id);
  const rank = new Map(nodes.map(node => [node.id, node.id === graph.entry ? 0 : 0]));
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) break;

    for (const transition of forwardTransitions.filter(candidate => candidate.from === nodeId)) {
      rank.set(transition.to, Math.max(rank.get(transition.to) ?? 0, (rank.get(nodeId) ?? 0) + 1));
      const nextIndegree = (indegree.get(transition.to) ?? 1) - 1;
      indegree.set(transition.to, nextIndegree);
      if (nextIndegree === 0) queue.push(transition.to);
    }
  }

  // Retry activities are often reused from a later validation branch. Keeping
  // the longest-path rank would push them past that branch and turn the first
  // retry into a graph-wide loop. Anchor them beside their earliest caller;
  // later callers then return through the same explicit retry lane.
  const retryNodeIds = new Set([...backTransitions].map(transition => transition.from));
  for (const nodeId of retryNodeIds) {
    const earliestIncomingRank = Math.min(
      ...forwardTransitions
        .filter(transition => transition.to === nodeId)
        .map(transition => (rank.get(transition.from) ?? 0) + 1),
    );
    if (Number.isFinite(earliestIncomingRank)) rank.set(nodeId, earliestIncomingRank);
  }

  const maximumRank = Math.max(0, ...rank.values());
  const columns = Array.from({ length: maximumRank + 1 }, (_, index) => ({
    id: `activity-column-${index}`,
    nodes: nodes.filter(node => rank.get(node.id) === index),
  })).filter(column => column.nodes.length > 0);

  return {
    backTransitions: [...backTransitions],
    columns,
    entry: nodes.find(node => node.isEntry),
    nodes,
    transitions: graph.transitions,
  };
};
