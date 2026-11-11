import { describe, expect, it } from 'vitest';

import { buildEntityStatechart, parseEntityModel } from './entity-model';

describe('Entity Model Markdown', () => {
  it('parses canonical behavior tables into typed model data', () => {
    const model = parseEntityModel(`
## Data

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| \`id\` | \`InvitationId\` | yes | Stable identity |

## States

| State | Kind | Meaning |
| --- | --- | --- |
| \`Pending\` | initial | Awaiting a decision |
| \`Accepted\` | terminal | Membership created |

## Operations

| Operation | Actor | Applies when | Transition | Effects |
| --- | --- | --- | --- | --- |
| [\`Accept\`](./accept.md) | \`Recipient\` | status is Pending | \`Pending -> Accepted\` | create Enrollment |

## Invariants

| Rule | Constraint |
| --- | --- |
| \`terminal-is-final\` | A terminal invitation cannot transition again |
`);

    expect(model.fields).toEqual([
      { meaning: 'Stable identity', name: 'id', required: true, type: 'InvitationId' },
    ]);
    expect(model.states.map(state => state.name)).toEqual(['Pending', 'Accepted']);
    expect(model.operations).toEqual([
      {
        actor: 'Recipient',
        appliesWhen: 'status is Pending',
        effects: 'create Enrollment',
        name: 'Accept',
        transition: 'Pending -> Accepted',
      },
    ]);
    expect(model.invariants[0]?.rule).toBe('terminal-is-final');
    expect(buildEntityStatechart(model)).toContain(
      'Pending --> Accepted : Accept · Recipient',
    );
  });
});
