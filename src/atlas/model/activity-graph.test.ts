import { describe, expect, it } from 'vitest';

import { validateActivityGraph, type ActivityGraph } from './activity-graph';

const graph = (overrides: Partial<ActivityGraph> = {}): ActivityGraph => ({
  entry: 'open',
  nodes: [
    {
      id: 'open',
      kind: 'stimulus',
      label: 'Open invitation',
      reads: [],
      presents: [],
    },
    {
      id: 'claim',
      kind: 'operation',
      label: 'Claim invitation',
      reads: [],
      presents: [],
      reference: { reference: 'workspace-invitation.claim' },
    },
  ],
  transitions: [{ from: 'open', to: 'claim' }],
  ...overrides,
});

describe('Activity Graph semantic model', () => {
  it('accepts a connected graph with referenced semantic nodes', () => {
    expect(validateActivityGraph(graph())).toEqual([]);
  });

  it('reports duplicate IDs, missing references, dangling transitions, and unreachable nodes', () => {
    const diagnostics = validateActivityGraph(
      graph({
        nodes: [
          ...graph().nodes,
          {
            id: 'claim',
            kind: 'interaction',
            label: 'Respond',
            reads: [],
            presents: [],
          },
          {
            id: 'orphan',
            kind: 'outcome',
            label: 'Orphan',
            reads: [],
            presents: [],
          },
        ],
        transitions: [
          { from: 'open', to: 'claim' },
          { from: 'missing', to: 'claim' },
        ],
      }),
    );

    expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'duplicate-node-id',
      'missing-semantic-reference',
      'dangling-transition',
      'unreachable-node',
    ]);
  });

  it('reports an entry that does not identify an authored node', () => {
    expect(validateActivityGraph(graph({ entry: 'missing' }))).toContainEqual({
      code: 'missing-entry-node',
      message: 'Activity entry missing does not identify an authored node.',
      path: 'entry',
      severity: 'error',
    });
  });
});
