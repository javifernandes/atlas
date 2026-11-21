import { describe, expect, it } from 'vitest';

import type { ActivityGraph } from '../model/activity-graph';
import { buildActivityGraphLensProjection } from './activity-graph-lens';
import {
  activityGraphEdgeLabel,
  activityGraphRevealDelta,
  buildActivityGraphEdgePath,
  buildActivityGraphLayout,
} from './activity-graph-layout';

describe('Activity Graph layout', () => {
  it('derives compact coordinates without changing the semantic graph', () => {
    const graph: ActivityGraph = {
      actors: [],
      entry: 'decision',
      nodes: [
        { id: 'decision', kind: 'decision', label: 'Accept?', reads: [], presents: [] },
        { id: 'accept', kind: 'operation', label: 'Accept invitation', reads: [], presents: [] },
        { id: 'decline', kind: 'operation', label: 'Decline invitation', reads: [], presents: [] },
      ],
      transitions: [
        { id: 'yes', affordance: 'Accept', from: 'decision', to: 'accept' },
        { id: 'no', affordance: 'Decline', from: 'decision', to: 'decline' },
      ],
    };

    const layout = buildActivityGraphLayout(buildActivityGraphLensProjection(graph));
    const decision = layout.nodes.find(node => node.id === 'decision');
    const accept = layout.nodes.find(node => node.id === 'accept');
    const decline = layout.nodes.find(node => node.id === 'decline');

    expect(decision?.x).toBeLessThan(accept?.x ?? 0);
    expect(accept?.y).toBeLessThan(decline?.y ?? 0);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    expect(graph.nodes[0]).not.toHaveProperty('x');
    expect(buildActivityGraphEdgePath(decision!, accept!, false)).toMatch(/^M .* C /);
  });

  it('keeps branch intent on edges but omits results repeated by outcome nodes', () => {
    expect(activityGraphEdgeLabel({ id: 'accept', affordance: 'Accept', from: 'a', to: 'b' })).toBe('Accept');
    expect(activityGraphEdgeLabel({ id: 'done', from: 'b', result: 'Invitation accepted', to: 'c' })).toBeUndefined();
  });

  it('reveals a selected node inside the canvas area left visible by an inspector', () => {
    expect(activityGraphRevealDelta(
      { bottom: 800, left: 0, right: 1200, top: 0 },
      { bottom: 500, left: 900, right: 1120, top: 418 },
      { rightOcclusion: 448 },
    )).toEqual({ x: -416, y: 0 });

    expect(activityGraphRevealDelta(
      { bottom: 800, left: 0, right: 1200, top: 0 },
      { bottom: 500, left: 400, right: 620, top: 418 },
      { rightOcclusion: 448 },
    )).toEqual({ x: 0, y: 0 });
  });
});
