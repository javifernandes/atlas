---
id: spec-workstream-atlas.access-identity.workspace.invitation.accept
kind: operation
title: Accept Workspace Invitation
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
    target: AtlasWorkspaceInvitation.accept
    status: planned
---

## Receiver

The Claimed Workspace Invitation being accepted.

## Actor

The authenticated User already bound as the invitation's claimant.

## Inputs And Output

No additional domain input. The result is active Workspace Membership with the proposed role.

## Availability

The invitation is Claimed by the current User and remains unexpired and unrevoked.

## Transition And Effects

`Claimed -> Accepted`. Create or activate one Membership for the claimant and Workspace with the
proposed role.

## Failures

- `InvitationUnavailable`
- `WrongClaimant`
- `MembershipConflict`

## Invariants Preserved

`proof-before-response`, `membership-once`, and `terminal-is-final`.
