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

  it('projects authored input, output, and failure tables without Markdown table syntax', () => {
    const model = parseOperationModel(`## Inputs And Output

| Direction | Value | Meaning |
| --------- | ----- | ------- |
| input | \`name\` | Human-readable name |
| output | \`Classroom\` | Persisted space |
| output | \`Owner Enrollment\` | Initial authority |

## Failures

| Failure | Meaning |
| ------- | ------- |
| \`user-not-active\` | User is inactive |
| \`actor-mismatch\` | Actor is not the receiver |`);

    expect(model.inputsAndOutput).toBe(
      'Inputs are name. The result is Classroom and Owner Enrollment',
    );
    expect(model.failures).toEqual(['user-not-active', 'actor-mismatch']);
    expect(buildOperationPseudocode('Create Classroom', model)).toContain(`  input "name"
  returns "Classroom and Owner Enrollment"`);
    expect(buildOperationPseudocode('Create Classroom', model)).toContain(`  fails with
    user-not-active
    actor-mismatch`);
    expect(buildOperationPseudocode('Create Classroom', model)).not.toContain('|');
    expect(buildOperationPseudocode('Create Classroom', model)).not.toContain('Direction');
  });
});
