import type {
  ActivityGraphLensNode,
  ActivityGraphLensProjection,
} from './activity-graph-lens';

const horizontalGap = 116;
const verticalGap = 28;
const canvasPadding = 48;

const nodeDimensions = (node: ActivityGraphLensNode) => {
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

export const buildActivityGraphEdgePath = (
  source: ActivityGraphLayoutNode,
  target: ActivityGraphLayoutNode,
  isBackTransition: boolean,
) => {
  const sourceX = source.x + source.width;
  const sourceY = source.y + source.height / 2;
  const targetX = target.x;
  const targetY = target.y + target.height / 2;

  if (isBackTransition || targetX <= sourceX) {
    const lift = Math.min(source.y, target.y) - 38;
    return `M ${sourceX} ${sourceY} C ${sourceX + 42} ${lift}, ${targetX - 42} ${lift}, ${targetX} ${targetY}`;
  }

  const bend = Math.max(44, (targetX - sourceX) * 0.46);
  return `M ${sourceX} ${sourceY} C ${sourceX + bend} ${sourceY}, ${targetX - bend} ${targetY}, ${targetX} ${targetY}`;
};

export const buildActivityGraphLayout = (
  projection: ActivityGraphLensProjection,
): ActivityGraphLayout => {
  const columnMetrics = projection.columns.map(column => {
    const dimensions = column.nodes.map(node => ({ node, ...nodeDimensions(node) }));
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
) => transition.affordance ?? transition.guard ?? transition.trigger;
