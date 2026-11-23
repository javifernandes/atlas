import type { ElkEdgeSection, ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';

import type { EntityModel } from '../model/snapshot';

export type EntityStateGraphNode = {
  id: string;
  kind: 'start' | 'state';
  label: string;
  stateKind?: string;
};

export type EntityStateGraphEdge = {
  actor?: string;
  from: string;
  id: string;
  label?: string;
  operationReference?: string;
  to: string;
};

export type EntityStateGraph = {
  edges: EntityStateGraphEdge[];
  nodes: EntityStateGraphNode[];
};

export type EntityStateGraphLayout = {
  edges: Array<EntityStateGraphEdge & {
    kind?: 'fork-trunk' | 'transition';
    labelX?: number;
    labelY?: number;
    path: string;
  }>;
  height: number;
  nodes: Array<EntityStateGraphNode & { height: number; width: number; x: number; y: number }>;
  width: number;
};

const stateId = (name: string) => `state:${name}`;

export const buildEntityStateGraph = (model: EntityModel): EntityStateGraph => {
  const nodes: EntityStateGraphNode[] = model.states.map(state => ({
    id: stateId(state.name),
    kind: 'state',
    label: state.name,
    stateKind: state.kind,
  }));
  const edges: EntityStateGraphEdge[] = [];
  let needsStart = false;

  for (const [index, operation] of model.operations.entries()) {
    const transition = operation.transition.match(/^(.+?)\s*->\s*(.+)$/);
    if (!transition) continue;
    const from = transition[1]?.trim() ?? '';
    const to = transition[2]?.trim() ?? '';
    if (!to || !model.states.some(state => state.name === to)) continue;
    const fromId = /^none$/i.test(from) ? 'state:$start' : stateId(from);
    if (fromId === 'state:$start') needsStart = true;
    if (fromId !== 'state:$start' && !model.states.some(state => state.name === from)) continue;

    edges.push({
      actor: operation.actor,
      from: fromId,
      id: `transition:${index}:${from}:${to}`,
      label: operation.name,
      operationReference: operation.reference,
      to: stateId(to),
    });
  }

  if (!needsStart) {
    for (const state of model.states.filter(state => state.kind === 'initial')) {
      needsStart = true;
      edges.push({
        from: 'state:$start',
        id: `initial:${state.name}`,
        to: stateId(state.name),
      });
    }
  }

  if (needsStart) nodes.unshift({ id: 'state:$start', kind: 'start', label: 'Start' });
  return { edges, nodes };
};

const points = (section: ElkEdgeSection) => [
  section.startPoint,
  ...(section.bendPoints ?? []),
  section.endPoint,
];

const sameCoordinate = (first: number, second: number) => Math.abs(first - second) < 0.01;

const straightenShortTargetDogleg = (sectionPoints: ReturnType<typeof points>) => {
  if (sectionPoints.length < 6) return sectionPoints;
  const approach = sectionPoints.at(-4);
  const lowerBend = sectionPoints.at(-3);
  const entryBend = sectionPoints.at(-2);
  const target = sectionPoints.at(-1);
  const beforeApproach = sectionPoints.at(-5);
  if (!approach || !lowerBend || !entryBend || !target || !beforeApproach) {
    return sectionPoints;
  }

  const hasFinalDogleg =
    sameCoordinate(beforeApproach.y, approach.y)
    && sameCoordinate(approach.x, lowerBend.x)
    && sameCoordinate(lowerBend.y, entryBend.y)
    && sameCoordinate(entryBend.x, target.x);
  const finalRun = Math.abs(target.y - entryBend.y);
  if (!hasFinalDogleg || finalRun >= 24) return sectionPoints;

  return [
    ...sectionPoints.slice(0, -4),
    { x: target.x, y: approach.y },
    target,
  ];
};

const roundedPath = (edge: ElkExtendedEdge, straightenTargetEntry: boolean) =>
  (edge.sections ?? [])
    .map(section => {
      const sectionPoints = points(section);
      const [first, ...rest] = straightenTargetEntry
        ? straightenShortTargetDogleg(sectionPoints)
        : sectionPoints;
      if (!first) return '';
      let path = `M ${first.x} ${first.y}`;
      for (const point of rest) {
        path += ` L ${point.x} ${point.y}`;
      }
      return path;
    })
    .filter(Boolean)
    .join(' ');

const dimensions = (node: EntityStateGraphNode) =>
  node.kind === 'start' ? { height: 22, width: 22 } : { height: 64, width: 190 };

const layoutOptions = (node: EntityStateGraphNode): Record<string, string> => {
  if (node.kind === 'start') {
    return { 'elk.layered.layering.layerConstraint': 'FIRST' };
  }
  if (node.stateKind === 'terminal') {
    return { 'elk.layered.layering.layerConstraint': 'LAST' };
  }
  return {};
};

export const buildEntityStateGraphLayout = async (
  graph: EntityStateGraph,
): Promise<EntityStateGraphLayout> => {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();
  const outgoingBySource = new Map<string, EntityStateGraphEdge[]>();
  for (const edge of graph.edges) {
    outgoingBySource.set(edge.from, [...(outgoingBySource.get(edge.from) ?? []), edge]);
  }
  const forkSources = new Set(
    [...outgoingBySource.entries()]
      .filter(([, edges]) => edges.length > 1)
      .map(([source]) => source),
  );
  const forkId = (source: string) => `fork:${source}`;
  const layoutEdges: Array<EntityStateGraphEdge & { kind: 'fork-trunk' | 'transition' }> = [
    ...[...forkSources].map(source => ({
      from: source,
      id: `fork-trunk:${source}`,
      kind: 'fork-trunk' as const,
      to: forkId(source),
    })),
    ...graph.edges.map(edge => ({
      ...edge,
      from: forkSources.has(edge.from) ? forkId(edge.from) : edge.from,
      kind: 'transition' as const,
    })),
  ];
  const layout = await elk.layout({
    children: [
      ...graph.nodes.map(node => ({
        id: node.id,
        ...dimensions(node),
        layoutOptions: layoutOptions(node),
      })),
      ...[...forkSources].map(source => ({
        height: 2,
        id: forkId(source),
        width: 2,
      })),
    ],
    edges: layoutEdges.map(edge => ({
      id: edge.id,
      labels: edge.label
        ? [{
            height: 28,
            id: `${edge.id}:label`,
            text: edge.label,
            width: Math.max(84, edge.label.length * 7 + 28),
          }]
        : [],
      sources: [edge.from],
      targets: [edge.to],
    })),
    id: 'entity-state-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.mergeEdges': 'false',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      'elk.layered.nodePlacement.favorStraightEdges': 'true',
      'elk.layered.spacing.edgeNodeBetweenLayers': '14',
      'elk.layered.unnecessaryBendpoints': 'false',
      'elk.layered.spacing.nodeNodeBetweenLayers': '24',
      'elk.padding': '[top=20,left=20,bottom=20,right=20]',
      'elk.spacing.nodeNode': '24',
    },
  } as ElkNode);
  const semanticNodes = new Map(graph.nodes.map(node => [node.id, node]));
  const semanticEdges = new Map(layoutEdges.map(edge => [edge.id, edge]));

  return {
    edges: (layout.edges ?? []).flatMap(edge => {
      const semantic = semanticEdges.get(edge.id);
      if (!semantic) return [];
      const label = edge.labels?.[0];
      return [
        {
          ...semantic,
          labelX: label?.x,
          labelY: label?.y,
          path: roundedPath(edge, semantic.kind === 'transition'),
        },
      ];
    }),
    height: layout.height ?? 0,
    nodes: (layout.children ?? []).flatMap(node => {
      const semantic = semanticNodes.get(node.id);
      if (!semantic) return [];
      const size = dimensions(semantic);
      return [
        {
          ...semantic,
          height: node.height ?? size.height,
          width: node.width ?? size.width,
          x: node.x ?? 0,
          y: node.y ?? 0,
        },
      ];
    }),
    width: layout.width ?? 0,
  };
};
