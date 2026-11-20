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

| Affordance | Kind | Target | Step |
| --- | --- | --- | --- |
| Invite | opens | [[workspace.invite-person\\|Invite person]] | Choose response |

## Presents

| Information | Source | Step |
| --- | --- | --- |
| Access status | [[workspace\\|Workspace access]] | Inspect access |

## Steps

| Step | Kind | Target | Next |
| --- | --- | --- | --- |
| Inspect access | presents | Workspace | Choose response |
| Choose response | branch | Recipient choice | Accept, Decline |
| Accept | invokes | [[workspace.accept\\|Accept invitation]] | |
| Decline | invokes | [[workspace.decline\\|Decline invitation]] | |

## Outcomes

| Outcome | Meaning | From | Continues with |
| --- | --- | --- | --- |
| Selected | Continue | Accept | [Invite person](./invite.md) |`,
      { binding: 'workspace', entity: 'AtlasWorkspace' },
    );

    expect(model).toMatchObject({
      actors: [{ actor: 'Owner', participation: 'Reviews access' }],
      affordances: [
        {
          affordanceKind: 'opens',
          atStep: 'Choose response',
          label: 'Invite',
          reference: 'workspace.invite-person',
          target: 'Invite person',
        },
      ],
      goal: 'Review observed contributors.',
      outcomes: [{ continuesWith: './invite.md', fromStep: 'Accept', outcome: 'Selected' }],
      presents: [
        {
          atStep: 'Inspect access',
          information: 'Access status',
          reference: 'workspace',
          source: 'Workspace access',
        },
      ],
      scope: { binding: 'workspace', entity: 'AtlasWorkspace' },
      steps: [
        { label: 'Inspect access', next: ['Choose response'], stepKind: 'presents' },
        { label: 'Choose response', next: ['Accept', 'Decline'], stepKind: 'branch' },
        { label: 'Accept', next: [], reference: 'workspace.accept', stepKind: 'invokes' },
        { label: 'Decline', next: [], reference: 'workspace.decline', stepKind: 'invokes' },
      ],
    });
  });
});
