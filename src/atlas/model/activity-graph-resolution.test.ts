import { describe, expect, it } from 'vitest';

import type { ActivityGraph } from './activity-graph';
import { resolveActivityGraphReferences } from './activity-graph-resolution';

const graph: ActivityGraph = {
  entry: 'inspect',
  nodes: [
    {
      id: 'inspect',
      kind: 'activity',
      label: 'Inspect invitation',
      reads: [{ label: 'Invitation', reference: 'workspace.invitation' }],
      presents: [{ reference: './workspace.md' }],
    },
    {
      id: 'claim',
      kind: 'operation',
      label: 'Claim invitation',
      reads: [],
      presents: [],
      reference: { reference: 'workspace.invitation.claim' },
    },
  ],
  transitions: [{ from: 'inspect', to: 'claim' }],
};

describe('Activity Graph reference resolution', () => {
  it('resolves every semantic-reference position without mutating the authored graph', () => {
    const resolved = resolveActivityGraphReferences(graph, reference =>
      reference.reference === 'missing' ? undefined : { targetNodeId: `atlas:${reference.reference}` },
    );

    expect(resolved.diagnostics).toEqual([]);
    expect(resolved.graph.nodes).toMatchObject([
      {
        reads: [
          {
            reference: 'workspace.invitation',
            resolution: 'resolved',
            targetNodeId: 'atlas:workspace.invitation',
          },
        ],
        presents: [
          {
            reference: './workspace.md',
            resolution: 'resolved',
            targetNodeId: 'atlas:./workspace.md',
          },
        ],
      },
      {
        reference: {
          reference: 'workspace.invitation.claim',
          resolution: 'resolved',
          targetNodeId: 'atlas:workspace.invitation.claim',
        },
      },
    ]);
    expect(graph.nodes[0]?.reads[0]?.resolution).toBeUndefined();
  });

  it('preserves unresolved references and reports their exact semantic position', () => {
    const resolved = resolveActivityGraphReferences(graph, reference =>
      reference.reference === 'workspace.invitation.claim'
        ? undefined
        : { targetNodeId: `atlas:${reference.reference}` },
    );

    expect(resolved.graph.nodes[1]?.reference).toEqual({
      reference: 'workspace.invitation.claim',
      resolution: 'unresolved',
    });
    expect(resolved.diagnostics).toContainEqual({
      code: 'unresolved-semantic-reference',
      message:
        'Activity reference workspace.invitation.claim does not identify an authored Atlas Item.',
      path: 'nodes.claim.ref',
      severity: 'warning',
    });
  });
});
