import { describe, expect, it } from 'vitest';

import {
  buildOperationPseudocode,
  buildOperationPseudocodeLines,
  parseOperationModel,
} from './operation-model';

describe('Operation model', () => {
  it('projects an authored contract as semantic pseudocode', () => {
    const model = {
      actor: 'A Workspace Owner.',
      availability: 'The actor may manage Membership.',
      failures: ['AccessDenied'],
      inputsAndOutput: 'Inputs are a recipient and role. The result is one Pending invitation.',
      invariantsPreserved: [{
        ownerReference: 'workspace-invitation',
        reference: 'workspace-invitation#invariant:address-is-not-proof',
        rule: 'address-is-not-proof',
      }],
      kind: 'operation' as const,
      realizationRefs: [],
      receiver: 'The Workspace.',
      transitionAndEffects: 'none -> Pending. Record the offer.',
    };

    expect(buildOperationPseudocode('Invite', model)).toBe(`operation Invite
  on "The Workspace"
  by "A Workspace Owner"

  input "a recipient and role"
  returns "one Pending invitation"

  requires "The actor may manage Membership"

  transitions none -> Pending
  effects "Record the offer"

  fails with
    AccessDenied

  preserves
    address-is-not-proof`);

    expect(buildOperationPseudocodeLines('Invite', model)).toContainEqual({
      indent: 1,
      keyword: 'transitions',
      value: 'none -> Pending',
      valueKind: 'transition',
    });
    expect(buildOperationPseudocodeLines('Invite', model)).toContainEqual({
      indent: 2,
      invariantReference: model.invariantsPreserved[0],
      value: 'address-is-not-proof',
      valueKind: 'invariant',
    });
  });

  it('normalizes multiple inline invariant names as scoped references', () => {
    const model = parseOperationModel(
      '## Invariants Preserved\n\n`one-workspace`, `address-is-not-proof`, and `membership-once`.',
      [],
      'workspace-invitation',
    );

    expect(model.invariantsPreserved).toEqual([
      {
        ownerReference: 'workspace-invitation',
        reference: 'workspace-invitation#invariant:one-workspace',
        rule: 'one-workspace',
      },
      {
        ownerReference: 'workspace-invitation',
        reference: 'workspace-invitation#invariant:address-is-not-proof',
        rule: 'address-is-not-proof',
      },
      {
        ownerReference: 'workspace-invitation',
        reference: 'workspace-invitation#invariant:membership-once',
        rule: 'membership-once',
      },
    ]);
  });
});
