---
id: spec-workstream-atlas.access-identity.workspace.invitation.claim
kind: operation
title: Claim Workspace Invitation
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
    target: AtlasWorkspaceInvitation.claim
    status: planned
---

## Receiver

The Pending Workspace Invitation being claimed.

## Actor

The authenticated User attempting to prove that the invitation addresses them.

## Inputs And Output

The proof required by the invitation's claim policy: an exact User identity, a stable provider
identity, or a signed invitation secret. The result is the Claimed invitation bound to that User.

## Availability

The invitation is Pending, unexpired, unrevoked, and has no existing claimant.

## Transition And Effects

`Pending -> Claimed`. Bind exactly one authenticated User after the selected proof succeeds.

## Failures

- `InvitationUnavailable`
- `IdentityProofRefused`
- `AlreadyClaimed`

## Invariants Preserved

`one-claimant`, `address-is-not-proof`, and `terminal-is-final`.
