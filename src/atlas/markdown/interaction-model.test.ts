import { describe, expect, it } from 'vitest';

import { parseInteractionModel } from './interaction-model';

describe('Interaction model', () => {
  it('preserves actor-facing anatomy and semantic references', () => {
    const model = parseInteractionModel(
      `## Goal

Review observed contributors.

## Actors

| Actor | Participation |
| --- | --- |
| Owner | Reviews access |

## Affordances

| Affordance | Kind | Target |
| --- | --- | --- |
| Invite | opens | [Invite person](./invite.md) |

## Outcomes

| Outcome | Meaning | Continues with |
| --- | --- | --- |
| Selected | Continue | [Invite person](./invite.md) |`,
      { binding: 'workspace', entity: 'AtlasWorkspace' },
    );

    expect(model).toMatchObject({
      actors: [{ actor: 'Owner', participation: 'Reviews access' }],
      affordances: [
        { affordanceKind: 'opens', label: 'Invite', reference: './invite.md' },
      ],
      goal: 'Review observed contributors.',
      outcomes: [{ continuesWith: './invite.md', outcome: 'Selected' }],
      scope: { binding: 'workspace', entity: 'AtlasWorkspace' },
    });
  });
});
