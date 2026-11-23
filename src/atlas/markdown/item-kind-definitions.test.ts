import { describe, expect, it } from 'vitest';

import { parseItemKindModel } from './item-kind-definitions';

describe('Item kind definitions', () => {
  it('parses typed Operation realization references without interpreting compact strings', () => {
    const model = parseItemKindModel('operation', {
      body: `## Receiver

The Workspace.

## Actor

A Workspace Owner.

## Inputs And Output

Inputs are a recipient and role. The result is one Pending invitation.

## Availability

The actor may manage Membership.

## Transition And Effects

\`none -> Pending\`. Record the offer.

## Failures

- \`AccessDenied\`

## Invariants Preserved

- \`address-is-not-proof\``,
      getString: key => key === 'parent' ? 'workspace-invitation' : '',
      getValue: key =>
        key === 'realizationRefs'
          ? [
              {
                namespace: 'ontahi',
                kind: 'operation',
                target: 'AtlasWorkspace.invite',
                status: 'planned',
              },
              { namespace: 'ontahi', kind: 'operation' },
            ]
          : undefined,
      sourcePath: 'atlas/items/invite.md',
    });

    expect(model).toEqual({
      actor: 'A Workspace Owner.',
      availability: 'The actor may manage Membership.',
      failures: ['AccessDenied'],
      inputsAndOutput: 'Inputs are a recipient and role. The result is one Pending invitation.',
      invariantsPreserved: [{
        ownerReference: 'workspace-invitation',
        reference: 'workspace-invitation#invariant:address-is-not-proof',
        rule: 'address-is-not-proof',
      }],
      kind: 'operation',
      realizationRefs: [
        {
          namespace: 'ontahi',
          kind: 'operation',
          target: 'AtlasWorkspace.invite',
          status: 'planned',
        },
      ],
      receiver: 'The Workspace.',
      transitionAndEffects: 'none -> Pending. Record the offer.',
    });
  });
});
