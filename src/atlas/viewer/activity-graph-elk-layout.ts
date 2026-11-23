import type {
  ElkEdgeSection,
  ElkExtendedEdge,
  ElkLabel,
  ElkNode,
  ElkPoint,
} from 'elkjs/lib/elk-api';

import type { ActivityGraphLensProjection } from './activity-graph-lens';
import {
  activityGraphEdgeLabel,
  activityGraphNodeDimensions,
  type ActivityGraphLayout,
} from './activity-graph-layout';

export type ActivityGraphLayoutEdge = {
  id: string;
  labelX?: number;
  labelY?: number;
  path: string;
};

export type ActivityGraphElkLayout = ActivityGraphLayout & {
  edges: ActivityGraphLayoutEdge[];
};

export type ActivityGraphLayoutDirection = 'horizontal' | 'vertical';

const roundedOrthogonalPath = (points: ElkPoint[], radius = 12) => {
  const [start, ...rest] = points;
  if (!start) return '';
  if (rest.length === 0) return `M ${start.x} ${start.y}`;

  let path = `M ${start.x} ${start.y}`;
  for (let index = 0; index < rest.length; index += 1) {
    const point = rest[index];
    const previous = index === 0 ? start : rest[index - 1];
    const next = rest[index + 1];
    if (!next) {
      path += ` L ${point.x} ${point.y}`;
      continue;
    }

    const incomingLength = Math.hypot(point.x - previous.x, point.y - previous.y);
    const outgoingLength = Math.hypot(next.x - point.x, next.y - point.y);
    const cornerRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2);
    const before = {
      x: point.x - ((point.x - previous.x) / incomingLength) * cornerRadius,
      y: point.y - ((point.y - previous.y) / incomingLength) * cornerRadius,
    };
    const after = {
      x: point.x + ((next.x - point.x) / outgoingLength) * cornerRadius,
      y: point.y + ((next.y - point.y) / outgoingLength) * cornerRadius,
    };
    path += ` L ${before.x} ${before.y} Q ${point.x} ${point.y} ${after.x} ${after.y}`;
  }
  return path;
};

const edgePoints = (section: ElkEdgeSection) => [
  section.startPoint,
  ...(section.bendPoints ?? []),
  section.endPoint,
];

const edgePath = (edge: ElkExtendedEdge) => (edge.sections ?? [])
  .map(section => roundedOrthogonalPath(edgePoints(section)))
  .filter(Boolean)
  .join(' ');

const branchLabelPosition = (edge: ElkExtendedEdge) => {
  const section = edge.sections?.[0];
  if (!section) return {};
  const [start, next] = edgePoints(section);
  if (!start || !next) return {};

  const distance = Math.hypot(next.x - start.x, next.y - start.y);
  if (!distance) return {};
  const progress = Math.min(34, distance / 2);
  const horizontal = Math.abs(next.x - start.x) >= Math.abs(next.y - start.y);
  return {
    labelX: start.x + ((next.x - start.x) / distance) * progress + (horizontal ? 0 : 14),
    labelY: start.y + ((next.y - start.y) / distance) * progress + (horizontal ? -12 : 0),
  };
};

const verticalEdgeLabelPosition = (edge: ElkExtendedEdge) => {
  const segments = (edge.sections ?? []).flatMap(section => {
    const points = edgePoints(section);
    return points.slice(1).map((point, index) => ({
      end: point,
      length: Math.hypot(point.x - points[index].x, point.y - points[index].y),
      start: points[index],
    }));
  });
  const segment = segments
    .filter(({ end, start }) => Math.abs(end.y - start.y) >= Math.abs(end.x - start.x))
    .sort((left, right) => right.length - left.length)[0] ?? segments[0];
  if (!segment) return {};

  return {
    labelX: (segment.start.x + segment.end.x) / 2 + 14,
    labelY: (segment.start.y + segment.end.y) / 2,
  };
};

const edgeLabelPosition = (
  edge: ElkExtendedEdge,
  nearSource: boolean,
  direction: ActivityGraphLayoutDirection,
) => {
  if (nearSource) return branchLabelPosition(edge);
  if (direction === 'vertical') return verticalEdgeLabelPosition(edge);
  const label = edge.labels?.[0];
  if (label?.x !== undefined && label.y !== undefined) {
    return {
      labelX: label.x + (label.width ?? 0) / 2,
      labelY: label.y + (label.height ?? 0) / 2,
    };
  }
  return {};
};

const elkLabel = (edgeId: string, text: string): ElkLabel => ({
  height: 20,
  id: `${edgeId}-label`,
  text,
  width: Math.min(176, Math.max(44, text.length * 5.2 + 14)),
});

const toElkGraph = (
  projection: ActivityGraphLensProjection,
  direction: ActivityGraphLayoutDirection,
): ElkNode => ({
  children: projection.nodes.map(node => ({
    id: node.id,
    ...activityGraphNodeDimensions(node),
  })),
  edges: projection.transitions.map(transition => {
    const label = activityGraphEdgeLabel(transition);
    return {
      id: transition.id,
      // In the vertical view labels sit beside their edge. Letting ELK reserve
      // space for them turns otherwise linear connections into false-looking
      // detours.
      labels: direction === 'horizontal' && label && !transition.branch
        ? [elkLabel(transition.id, label)]
        : [],
      sources: [transition.from],
      targets: [transition.to],
    };
  }),
  id: 'activity-root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': direction === 'horizontal' ? 'RIGHT' : 'DOWN',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.cycleBreaking.strategy': 'GREEDY_MODEL_ORDER',
    'elk.layered.feedbackEdges': 'true',
    // The vertical view reads as a decision tree. SIMPLE keeps every parent on
    // the midpoint of its immediate children, even when later merges make one
    // branch much heavier than another. The horizontal view benefits from the
    // more compact Brandes-Koepf placement instead.
    'elk.layered.nodePlacement.strategy': direction === 'vertical'
      ? 'SIMPLE'
      : 'BRANDES_KOEPF',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '16',
    'elk.layered.spacing.edgeNodeBetweenLayers': '24',
    'elk.padding': '[top=48,left=48,bottom=48,right=48]',
    'elk.spacing.edgeLabel': '8',
    'elk.spacing.nodeNode': '48',
    'elk.layered.spacing.nodeNodeBetweenLayers': '68',
  },
});

export const buildActivityGraphElkLayout = async (
  projection: ActivityGraphLensProjection,
  direction: ActivityGraphLayoutDirection = 'horizontal',
): Promise<ActivityGraphElkLayout> => {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();
  const graph = await elk.layout(toElkGraph(projection, direction));
  const semanticNodes = new Map(projection.nodes.map(node => [node.id, node]));
  const semanticTransitions = new Map(
    projection.transitions.map(transition => [transition.id, transition]),
  );

  return {
    edges: (graph.edges ?? []).map(edge => ({
      id: edge.id,
      ...edgeLabelPosition(
        edge,
        Boolean(semanticTransitions.get(edge.id)?.branch),
        direction,
      ),
      path: edgePath(edge),
    })),
    height: graph.height ?? 0,
    nodes: (graph.children ?? []).flatMap(node => {
      const semanticNode = semanticNodes.get(node.id);
      if (!semanticNode) return [];
      const dimensions = activityGraphNodeDimensions(semanticNode);
      return [{
        ...semanticNode,
        height: node.height ?? dimensions.height,
        width: node.width ?? dimensions.width,
        x: node.x ?? 0,
        y: node.y ?? 0,
      }];
    }),
    width: graph.width ?? 0,
  };
};
