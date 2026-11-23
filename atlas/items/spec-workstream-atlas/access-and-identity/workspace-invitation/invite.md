---
id: spec-workstream-atlas.access-identity.workspace.invitation.invite
kind: operation
title: Invite
parent: spec-workstream-atlas.access-identity.workspace.invitation
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.access-identity.workspace.invitation
  - spec-workstream-atlas.access-identity.workspace.invite-person-to-workspace
relatedPlans:
  - plans/current/149-interaction-model-v0.md
realizationRefs:
  - namespace: ontahi
    kind: operation
    target: AtlasWorkspace.invite
    status: planned
---

Invite records an authorized offer of Workspace access. The behavior is named for its domain
intent; creating a Workspace Invitation record is one effect, not the Operation's identity.

## Receiver

The Workspace whose access is being offered.

## Actor

A Workspace Owner authorized to manage Membership.

## Inputs And Output

Inputs are one recipient address, its required claim policy, a collaborator or viewer role, and an
expiry. The result is one Pending
[[spec-workstream-atlas.access-identity.workspace.invitation|Workspace Invitation]].

## Availability

The actor may manage Workspace Membership, the recipient can be addressed unambiguously, and no
equivalent active Membership or Pending invitation exists.

## Transition And Effects

`none -> Pending`. Record the intended recipient, proof policy, proposed role, expiry, Workspace,
and inviting User. Do not create Membership and do not treat addressing evidence as identity proof.

## Failures

- `RecipientCannotBeAddressed`
- `ExistingAccess`
- `EquivalentInvitationExists`
- `InvitationPolicyRefused`
- `AccessDenied`

## Invariants Preserved

- `one-workspace`
- `address-is-not-proof`
- `membership-once`
