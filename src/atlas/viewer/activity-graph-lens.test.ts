import { describe, expect, it } from 'vitest';

import type { ActivityGraph } from '../model/activity-graph';
import { buildActivityGraphLensProjection } from './activity-graph-lens';

const graph: ActivityGraph = {
  actors: [
    {
      id: 'recipient',
      label: 'Invitation Recipient',
      description: 'The person responding to the invitation.',
      context: [{ reference: 'workspace-invitation' }],
    },
  ],
  entry: 'open',
  nodes: [
    { id: 'open', kind: 'stimulus', label: 'Open', actor: 'recipient', reads: [], presents: [] },
    { id: 'eligible', kind: 'decision', label: 'Eligible?', reads: [], presents: [] },
    { id: 'done', kind: 'outcome', label: 'Done', reads: [], presents: [] },
  ],
  transitions: [
    { id: 'opened', from: 'open', to: 'eligible', trigger: 'link opened' },
    { id: 'allowed', affordance: 'Continue', from: 'eligible', guard: 'allowed', to: 'done' },
    { id: 'retry', affordance: 'Try again', from: 'eligible', guard: 'not allowed', to: 'open' },
  ],
};

describe('Activity Graph lens projection', () => {
  it('preserves graph semantics while attaching adjacency for presentation', () => {
    const projection = buildActivityGraphLensProjection(graph);

    expect(projection.entry).toMatchObject({
      id: 'open',
      isEntry: true,
      actorBinding: {
        id: 'recipient',
        label: 'Invitation Recipient',
      },
    });
    expect(projection.nodes.find(node => node.id === 'eligible')).toMatchObject({
      incoming: [{ id: 'opened', from: 'open', to: 'eligible', trigger: 'link opened' }],
      outgoing: [
        { id: 'allowed', affordance: 'Continue', from: 'eligible', guard: 'allowed', to: 'done' },
        { id: 'retry', affordance: 'Try again', from: 'eligible', guard: 'not allowed', to: 'open' },
      ],
    });
    expect(projection.transitions).toEqual(graph.transitions);
    expect(projection.columns.map(column => column.nodes.map(node => node.id))).toEqual([
      ['open'],
      ['eligible'],
      ['done'],
    ]);
    expect(projection.backTransitions).toEqual([
      { id: 'retry', affordance: 'Try again', from: 'eligible', guard: 'not allowed', to: 'open' },
    ]);
  });

  it('anchors a reused retry activity beside its earliest caller', () => {
    const retryGraph: ActivityGraph = {
      actors: [],
      entry: 'checkpoint',
      nodes: [
        { id: 'checkpoint', kind: 'decision', label: 'Authenticated?', reads: [], presents: [] },
        { id: 'authenticate', kind: 'activity', label: 'Sign in', reads: [], presents: [] },
        { id: 'continue', kind: 'decision', label: 'Continue', reads: [], presents: [] },
        { id: 'mismatch', kind: 'decision', label: 'Matches?', reads: [], presents: [] },
      ],
      transitions: [
        { id: 'initial-auth', from: 'checkpoint', to: 'authenticate' },
        { id: 'authenticated', from: 'checkpoint', to: 'continue' },
        { id: 'validate', from: 'continue', to: 'mismatch' },
        { id: 'switch-account', from: 'mismatch', to: 'authenticate' },
        { id: 'retry', from: 'authenticate', to: 'checkpoint' },
      ],
    };

    const projection = buildActivityGraphLensProjection(retryGraph);

    expect(projection.columns.map(column => column.nodes.map(node => node.id))).toEqual([
      ['checkpoint'],
      ['authenticate', 'continue'],
      ['mismatch'],
    ]);
  });
});
