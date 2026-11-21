export type SpatialNavigationDirection = 'down' | 'left' | 'right' | 'up';

export type SpatialNavigationNode = {
  id: string;
  x: number;
  y: number;
};

export const getDirectionalNavigationTarget = (
  currentId: string,
  direction: SpatialNavigationDirection,
  nodes: SpatialNavigationNode[],
) => {
  const current = nodes.find(node => node.id === currentId);
  if (!current) return undefined;

  return nodes
    .filter(node => node.id !== currentId)
    .map(node => {
      const deltaX = node.x - current.x;
      const deltaY = node.y - current.y;
      const primaryDistance =
        direction === 'left'
          ? -deltaX
          : direction === 'right'
            ? deltaX
            : direction === 'up'
              ? -deltaY
              : deltaY;
      const crossDistance =
        direction === 'left' || direction === 'right' ? Math.abs(deltaY) : Math.abs(deltaX);

      return {
        node,
        primaryDistance,
        score: primaryDistance + crossDistance * 1.75,
      };
    })
    .filter(candidate => candidate.primaryDistance > 1)
    .sort((left, right) => left.score - right.score)[0]?.node;
};
