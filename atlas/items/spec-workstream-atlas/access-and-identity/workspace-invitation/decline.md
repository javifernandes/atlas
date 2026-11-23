---
id: spec-workstream-atlas.access-identity.workspace.invitation.decline
kind: operation
title: Decline Workspace Invitation
parent: spec-workstream-atlas.access-identity.workspace.invitation
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.access-identity.workspace.invitation
  - spec-workstream-atlas.access-identity.workspace.respond-to-invitation
relatedPlans:
  - plans/current/149-interaction-model-v0.md
realizationRefs:
  - namespace: ontahi
    kind: operation
    target: AtlasWorkspaceInvitation.decline
    status: planned
---

## Receiver

The Claimed Workspace Invitation being declined.

## Actor

The authenticated User already bound as the invitation's claimant.

## Inputs And Output

No additional domain input. The result is a terminal Declined invitation and no Membership.

## Availability

The invitation is Claimed by the current User and remains unexpired and unrevoked.

## Transition And Effects

`Claimed -> Declined`. Close the invitation without creating or activating Membership.

## Failures

- `InvitationUnavailable`
- `WrongClaimant`

## Invariants Preserved

`proof-before-response`, `membership-once`, and `terminal-is-final`.
