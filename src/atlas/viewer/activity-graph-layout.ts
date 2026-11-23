import type {
  ActivityGraphLensNode,
  ActivityGraphLensProjection,
} from './activity-graph-lens';

const horizontalGap = 116;
const verticalGap = 56;
const canvasPadding = 92;
const edgeCorridorGap = 48;

export const activityGraphNodeDimensions = (node: ActivityGraphLensNode) => {
  if (node.kind === 'merge') return { height: 48, width: 168 };
  if (node.kind === 'outcome') return { height: 68, width: 208 };
  return { height: 82, width: 220 };
};

export type ActivityGraphLayoutNode = ActivityGraphLensNode & {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type ActivityGraphLayout = {
  height: number;
  nodes: ActivityGraphLayoutNode[];
  width: number;
};

type ActivityGraphViewportBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export const activityGraphRevealDelta = (
  viewport: ActivityGraphViewportBounds,
  node: ActivityGraphViewportBounds,
  { margin = 48, rightOcclusion = 0 }: { margin?: number; rightOcclusion?: number } = {},
) => {
  const visibleRight = Math.max(
    viewport.left + margin,
    viewport.right - rightOcclusion - margin,
  );
  const x =
    node.left < viewport.left + margin
      ? viewport.left + margin - node.left
      : node.right > visibleRight
        ? visibleRight - node.right
        : 0;
  const y =
    node.top < viewport.top + margin
      ? viewport.top + margin - node.top
      : node.bottom > viewport.bottom - margin
        ? viewport.bottom - margin - node.bottom
        : 0;

  return { x, y };
};

export const buildActivityGraphEdgePath = (
  source: ActivityGraphLayoutNode,
  target: ActivityGraphLayoutNode,
  isBackTransition: boolean,
  canvasHeight?: number,
) => {
  const sourceX = source.x + source.width;
  const sourceY = source.y + source.height / 2;
  const targetX = target.x;
  const targetY = target.y + target.height / 2;

  if (isBackTransition || targetX <= sourceX) {
    const returnSourceX = source.x;
    const returnTargetX = target.x + target.width;
    const corridorY = Math.max(
      source.y + source.height,
      target.y + target.height,
    ) + edgeCorridorGap;
    return `M ${returnSourceX} ${sourceY} C ${returnSourceX - 32} ${sourceY}, ${returnSourceX - 32} ${corridorY}, ${returnSourceX - 64} ${corridorY} L ${returnTargetX + 64} ${corridorY} C ${returnTargetX + 32} ${corridorY}, ${returnTargetX + 32} ${targetY}, ${returnTargetX} ${targetY}`;
  }

  const span = targetX - sourceX;
  if (span > horizontalGap * 1.5) {
    const graphMiddle = (canvasHeight ?? Math.max(
      source.y + source.height,
      target.y + target.height,
    )) / 2;
    const routeAbove = sourceY <= graphMiddle;
    const corridorY = routeAbove
      ? Math.min(source.y, target.y) - edgeCorridorGap
      : Math.max(source.y + source.height, target.y + target.height) + edgeCorridorGap;
    return `M ${sourceX} ${sourceY} C ${sourceX + 32} ${sourceY}, ${sourceX + 32} ${corridorY}, ${sourceX + 64} ${corridorY} L ${targetX - 64} ${corridorY} C ${targetX - 32} ${corridorY}, ${targetX - 32} ${targetY}, ${targetX} ${targetY}`;
  }

  const bend = Math.max(44, (targetX - sourceX) * 0.46);
  return `M ${sourceX} ${sourceY} C ${sourceX + bend} ${sourceY}, ${targetX - bend} ${targetY}, ${targetX} ${targetY}`;
};

export const buildActivityGraphLayout = (
  projection: ActivityGraphLensProjection,
): ActivityGraphLayout => {
  const backTransitionSources = new Set(
    projection.backTransitions.map(transition => transition.from),
  );
  const columnMetrics = projection.columns.map(column => {
    const dimensions = column.nodes
      .map((node, authoredIndex) => ({
        authoredIndex,
        node,
        ...activityGraphNodeDimensions(node),
      }))
      .sort((left, right) => {
        const leftReturns = backTransitionSources.has(left.node.id) ? 1 : 0;
        const rightReturns = backTransitionSources.has(right.node.id) ? 1 : 0;
        return leftReturns - rightReturns || left.authoredIndex - right.authoredIndex;
      });
    return {
      dimensions,
      height:
        dimensions.reduce((total, node) => total + node.height, 0) +
        Math.max(0, dimensions.length - 1) * verticalGap,
      width: Math.max(0, ...dimensions.map(node => node.width)),
    };
  });
  const contentHeight = Math.max(0, ...columnMetrics.map(column => column.height));
  let x = canvasPadding;
  const nodes: ActivityGraphLayoutNode[] = [];

  for (const column of columnMetrics) {
    let y = canvasPadding + (contentHeight - column.height) / 2;
    for (const dimensions of column.dimensions) {
      nodes.push({
        ...dimensions.node,
        height: dimensions.height,
        width: dimensions.width,
        x: x + (column.width - dimensions.width) / 2,
        y,
      });
      y += dimensions.height + verticalGap;
    }
    x += column.width + horizontalGap;
  }

  return {
    height: contentHeight + canvasPadding * 2,
    nodes,
    width: Math.max(canvasPadding * 2, x - horizontalGap + canvasPadding),
  };
};

export const activityGraphEdgeLabel = (
  transition: ActivityGraphLensProjection['transitions'][number],
) => transition.branch ?? transition.affordance ?? transition.guard ?? transition.trigger;
