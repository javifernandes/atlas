import { describe, expect, it } from 'vitest';

import { validateActivityGraph, type ActivityGraph } from './activity-graph';

const graph = (overrides: Partial<ActivityGraph> = {}): ActivityGraph => ({
  actors: [],
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
  transitions: [{ id: 'open-to-claim', from: 'open', to: 'claim' }],
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
          { id: 'open-to-claim', from: 'open', to: 'claim' },
          { id: 'missing-to-claim', from: 'missing', to: 'claim' },
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

  it('requires stable transition IDs and declared actor bindings', () => {
    const diagnostics = validateActivityGraph(
      graph({
        nodes: graph().nodes.map(node =>
          node.id === 'open' ? { ...node, actor: 'recipient' } : node,
        ),
        transitions: [
          { id: 'advance', from: 'open', to: 'claim' },
          { id: 'advance', from: 'open', to: 'claim' },
        ],
      }),
    );

    expect(diagnostics).toContainEqual({
      code: 'missing-actor-binding',
      message: 'Activity node open references missing actor binding recipient.',
      path: 'nodes.open.actor',
      severity: 'error',
    });
    expect(diagnostics).toContainEqual({
      code: 'duplicate-transition-id',
      message: 'Activity transition advance is declared more than once.',
      path: 'transitions.1.id',
      severity: 'error',
    });
  });
});
