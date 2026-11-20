import { describe, expect, it } from 'vitest';

import type { ActivityGraph } from '../model/activity-graph';
import { buildActivityGraphLensProjection } from './activity-graph-lens';

const graph: ActivityGraph = {
  entry: 'open',
  nodes: [
    { id: 'open', kind: 'stimulus', label: 'Open', reads: [], presents: [] },
    { id: 'eligible', kind: 'decision', label: 'Eligible?', reads: [], presents: [] },
    { id: 'done', kind: 'outcome', label: 'Done', reads: [], presents: [] },
  ],
  transitions: [
    { from: 'open', to: 'eligible', trigger: 'link opened' },
    { affordance: 'Continue', from: 'eligible', guard: 'allowed', to: 'done' },
    { affordance: 'Try again', from: 'eligible', guard: 'not allowed', to: 'open' },
  ],
};

describe('Activity Graph lens projection', () => {
  it('preserves graph semantics while attaching adjacency for presentation', () => {
    const projection = buildActivityGraphLensProjection(graph);

    expect(projection.entry).toMatchObject({ id: 'open', isEntry: true });
    expect(projection.nodes.find(node => node.id === 'eligible')).toMatchObject({
      incoming: [{ from: 'open', to: 'eligible', trigger: 'link opened' }],
      outgoing: [
        { affordance: 'Continue', from: 'eligible', guard: 'allowed', to: 'done' },
        { affordance: 'Try again', from: 'eligible', guard: 'not allowed', to: 'open' },
      ],
    });
    expect(projection.transitions).toEqual(graph.transitions);
    expect(projection.columns.map(column => column.nodes.map(node => node.id))).toEqual([
      ['open'],
      ['eligible'],
      ['done'],
    ]);
    expect(projection.backTransitions).toEqual([
      { affordance: 'Try again', from: 'eligible', guard: 'not allowed', to: 'open' },
    ]);
  });
});
