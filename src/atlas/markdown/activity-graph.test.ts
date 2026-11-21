import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseActivityGraph } from './activity-graph';

describe('Activity Graph YAML adapter', () => {
  it('normalizes an explicit atlas-activity YAML block', () => {
    const parsed = parseActivityGraph(`
# Respond To Workspace Invitation

\`\`\`atlas-activity
activity:
  entry: open-invitation
  actors:
    recipient:
      label: Invitation Recipient
      description: The person responding to the invitation.
      context:
        - workspace-invitation
  nodes:
    open-invitation:
      kind: stimulus
      actor: recipient
      label: Open invitation URL
      reads:
        - ref: workspace-invitation
          label: Invitation
    can-respond:
      kind: decision
      label: Invitation allows response
      reads:
        - workspace-invitation.status
    claim:
      kind: operation
      label: Claim invitation
      ref: workspace-invitation.claim
  transitions:
    - id: invitation-opened
      from: open-invitation
      to: can-respond
    - id: invitation-claimable
      from: can-respond
      to: claim
      guard: invitation is pending
      affordance: Continue
\`\`\`
`);

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.graph).toMatchObject({
      actors: [
        {
          context: [{ reference: 'workspace-invitation' }],
          description: 'The person responding to the invitation.',
          id: 'recipient',
          label: 'Invitation Recipient',
        },
      ],
      entry: 'open-invitation',
      nodes: [
        {
          actor: 'recipient',
          id: 'open-invitation',
          kind: 'stimulus',
          reads: [{ label: 'Invitation', reference: 'workspace-invitation' }],
        },
        {
          id: 'can-respond',
          kind: 'decision',
          reads: [{ reference: 'workspace-invitation.status' }],
        },
        {
          id: 'claim',
          kind: 'operation',
          reference: { reference: 'workspace-invitation.claim' },
        },
      ],
      transitions: [
        { id: 'invitation-opened', from: 'open-invitation', to: 'can-respond' },
        {
          id: 'invitation-claimable',
          affordance: 'Continue',
          from: 'can-respond',
          guard: 'invitation is pending',
          to: 'claim',
        },
      ],
    });
  });

  it('ignores ordinary YAML examples and malformed unrelated fences', () => {
    expect(
      parseActivityGraph(`
\`\`\`yaml
activity:
  entry: example-only
\`\`\`
`),
    ).toEqual({ diagnostics: [] });
  });

  it('reports YAML and semantic validation errors separately from rendering', () => {
    const invalidYaml = parseActivityGraph(`
\`\`\`atlas-activity
activity: [
\`\`\`
`);
    expect(invalidYaml.diagnostics[0]?.code).toBe('invalid-yaml');

    const invalidGraph = parseActivityGraph(`
\`\`\`atlas-activity
activity:
  entry: missing
  nodes:
    open:
      kind: screen
  transitions:
    - id: open-to-nowhere
      from: open
      to: nowhere
\`\`\`
`);
    expect(invalidGraph.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'invalid-node-kind',
      'missing-entry-node',
      'dangling-transition',
      'dangling-transition',
    ]);
  });

  it('reports unsupported responsibility values without coupling them to node kinds', () => {
    const result = parseActivityGraph(`
\`\`\`atlas-activity
activity:
  entry: inspect
  nodes:
    inspect:
      kind: activity
      responsibility: database
  transitions: []
\`\`\`
`);

    expect(result.diagnostics).toContainEqual({
      code: 'invalid-responsibility',
      message: 'Activity node inspect has unsupported responsibility database.',
      path: 'nodes.inspect.responsibility',
      severity: 'error',
    });
  });

  it('parses the authored Workspace invitation exemplar without diagnostics', () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        'atlas/items/spec-workstream-atlas/access-and-identity/respond-to-workspace-invitation.md',
      ),
      'utf8',
    );
    const result = parseActivityGraph(source);

    expect(result.diagnostics).toEqual([]);
    expect(result.graph).toMatchObject({
      entry: 'open-invitation',
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: 'resolve-context', kind: 'activity' }),
        expect.objectContaining({ id: 'addressing-policy', kind: 'decision' }),
        expect.objectContaining({ id: 'claim-invitation', kind: 'operation' }),
      ]),
    });
  });
});
