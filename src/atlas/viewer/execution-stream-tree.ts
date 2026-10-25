import type { AtlasExecutionStreamProjection } from '../model/execution-stream';
import type {
  PlanWorkstreamNode,
  PlanWorkstreamSnapshot,
} from '../model/snapshot';

export type ExecutionTreeRow = {
  depth: number;
  hasChildren: boolean;
  node: PlanWorkstreamNode;
};

type ExecutionTreeViewOptions = {
  collapsedNodeIds: ReadonlySet<string>;
  hideDone: boolean;
};

export const planSourceLabel = (node: PlanWorkstreamNode) => {
  const path = node.path ?? '';
  const scheme = path.match(/^([^:]+):\/\//)?.[1] ?? 'atlas';
  const planNumber = path.split('/').at(-1)?.match(/^(\d+[a-z]?)/i)?.[1];

  return planNumber ? `${scheme} · plan ${planNumber}` : scheme;
};

export const buildExecutionTreeRows = (
  stream: AtlasExecutionStreamProjection,
  snapshot: PlanWorkstreamSnapshot,
  { collapsedNodeIds, hideDone }: ExecutionTreeViewOptions,
): ExecutionTreeRow[] => {
  const planNodes = snapshot.nodes.filter(node => node.kind === 'plan');
  const nodesById = new Map(planNodes.map(node => [node.id, node] as const));
  const parentByChild = new Map<string, string>();
  const childrenByParent = new Map<string, string[]>();

  for (const edge of snapshot.edges) {
    if (
      edge.kind !== 'contains' ||
      !nodesById.has(edge.from) ||
      !nodesById.has(edge.to)
    ) {
      continue;
    }

    parentByChild.set(edge.to, edge.from);
    childrenByParent.set(edge.from, [...(childrenByParent.get(edge.from) ?? []), edge.to]);
  }

  const rootIds = stream.roots.map(root => root.id).filter(id => nodesById.has(id));
  const touchedIds = [
    ...stream.activities.flatMap(activity => (activity.plan ? [activity.plan.id] : [])),
    ...(stream.currentFocusPlan ? [stream.currentFocusPlan.id] : []),
  ].filter(id => nodesById.has(id));
  const includedIds = new Set(rootIds);

  for (const touchedId of touchedIds) {
    let currentId: string | undefined = touchedId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      includedIds.add(currentId);
      currentId = parentByChild.get(currentId);
    }
  }

  for (const pathId of [...includedIds]) {
    for (const childId of childrenByParent.get(pathId) ?? []) {
      includedIds.add(childId);
    }
  }

  const rows: ExecutionTreeRow[] = [];
  const processed = new Set<string>();
  const sortedChildren = (nodeId: string) =>
    [...(childrenByParent.get(nodeId) ?? [])]
      .filter(childId => includedIds.has(childId))
      .sort((left, right) =>
        (nodesById.get(left)?.shortTitle ?? left).localeCompare(
          nodesById.get(right)?.shortTitle ?? right,
        ),
      );
  const visibleChildren = (nodeId: string, visited = new Set<string>()): string[] => {
    if (visited.has(nodeId)) {
      return [];
    }

    const nextVisited = new Set(visited).add(nodeId);

    return sortedChildren(nodeId).flatMap(childId => {
      const child = nodesById.get(childId);

      return hideDone && child?.statusGroup === 'done'
        ? visibleChildren(childId, nextVisited)
        : [childId];
    });
  };
  const markDescendantsProcessed = (nodeId: string, visited = new Set<string>()) => {
    if (visited.has(nodeId)) {
      return;
    }

    const nextVisited = new Set(visited).add(nodeId);

    for (const childId of sortedChildren(nodeId)) {
      processed.add(childId);
      markDescendantsProcessed(childId, nextVisited);
    }
  };
  const append = (nodeId: string, depth: number) => {
    const node = nodesById.get(nodeId);

    if (!node || processed.has(nodeId) || !includedIds.has(nodeId)) {
      return;
    }

    processed.add(nodeId);
    const children = hideDone ? visibleChildren(nodeId) : sortedChildren(nodeId);

    if (hideDone && node.statusGroup === 'done') {
      for (const childId of children) {
        append(childId, depth);
      }
      return;
    }

    rows.push({ depth, hasChildren: children.length > 0, node });

    if (collapsedNodeIds.has(nodeId)) {
      markDescendantsProcessed(nodeId);
      return;
    }

    for (const childId of children) {
      append(childId, depth + 1);
    }
  };

  for (const rootId of rootIds) {
    append(rootId, 0);
  }

  for (const touchedId of touchedIds) {
    if (!processed.has(touchedId)) {
      append(touchedId, 0);
    }
  }

  return rows;
};
