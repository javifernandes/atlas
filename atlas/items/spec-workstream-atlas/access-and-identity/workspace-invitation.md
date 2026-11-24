---
id: spec-workstream-atlas.access-identity.workspace.invitation
kind: entity
title: Workspace Invitation
parent: spec-workstream-atlas.access-identity.workspace
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.access-identity.workspace
  - spec-workstream-atlas.access-identity.workspace.invite-person-to-workspace
  - spec-workstream-atlas.access-identity.workspace.respond-to-invitation
relatedPlans:
  - plans/current/149-interaction-model-v0.md
  - plans/current/159-workspace-invitations-end-to-end.md
  - plans/current/142-workspace-administration-settings.md
---

A Workspace Invitation is the durable intent to offer one person access to one Workspace. It keeps
recipient addressing, identity proof, response, and Membership creation separate: selecting an
Atlas User, provider identity, or delivery address does not itself prove the future claimant and
never grants access.

The invitation owns the lifecycle between an authorized owner's offer and a terminal response,
revocation, or expiry. A successful acceptance creates or activates Membership; it does not turn
the invitation itself into Membership.

## Data

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | `WorkspaceInvitationId` | yes | Stable invitation identity |
| `recipientAddress` | `UserId \| ProviderIdentityRef \| EmailAddress` | yes | Intended recipient without claiming proof of control |
| `claimPolicy` | `KnownUser \| ProviderIdentity \| SignedSecret` | yes | Proof required before a User may claim the invitation |
| `proposedRole` | `Collaborator \| Viewer` | yes | Access offered if the invitation is accepted |
| `expiresAt` | `Instant` | yes | Last instant at which the invitation may be claimed or answered |
| `status` | `WorkspaceInvitationStatus` | yes | Current lifecycle state |

## Relations

| Relation | Target | Cardinality | Meaning |
| --- | --- | --- | --- |
| `workspace` | [[spec-workstream-atlas.access-identity.workspace\|Workspace]] | one | Workspace whose access is offered |
| `invitedBy` | [[spec-workstream-atlas.access-identity.persistent-user\|Persistent User]] | one | User who created the invitation |
| `claimedBy` | [[spec-workstream-atlas.access-identity.persistent-user\|Persistent User]] | zero or one | User who proved the required recipient identity |
| `membership` | Workspace Membership | zero or one | Access created or activated by acceptance |

## States

| State | Kind | Meaning |
| --- | --- | --- |
| `Pending` | initial | The offer exists and may still be claimed |
| `Claimed` | active | One authenticated User proved the required recipient identity |
| `Accepted` | terminal | The claimed User accepted and Membership is active |
| `Declined` | terminal | The claimed User declined the offered access |
| `Revoked` | terminal | An authorized Workspace actor withdrew the offer |
| `Expired` | terminal | The response window ended without acceptance |

## Operations

| Operation | Actor | Applies when | Transition | Effects |
| --- | --- | --- | --- | --- |
| [[spec-workstream-atlas.access-identity.workspace.invitation.invite\|Invite]] | Workspace Owner | actor may manage membership and no equivalent access or invitation exists | `none -> Pending` | record recipient address, proof policy, proposed role, and expiry |
| [[spec-workstream-atlas.access-identity.workspace.invitation.claim\|Claim]] | Invitation Recipient | status is Pending and required identity proof succeeds | `Pending -> Claimed` | bind exactly one authenticated User as claimant |
| [[spec-workstream-atlas.access-identity.workspace.invitation.accept\|Accept]] | Claimed Recipient | status is Claimed by the current User | `Claimed -> Accepted` | create or activate Membership with the proposed role |
| [[spec-workstream-atlas.access-identity.workspace.invitation.decline\|Decline]] | Claimed Recipient | status is Claimed by the current User | `Claimed -> Declined` | close the invitation without Membership |
| `Revoke` | Workspace Owner | status is Pending | `Pending -> Revoked` | withdraw the outstanding offer |
| `Revoke` | Workspace Owner | status is Claimed | `Claimed -> Revoked` | withdraw the claimed offer before acceptance |
| `Expire` | System | status is Pending and expiry has elapsed | `Pending -> Expired` | make the invitation unavailable |
| `Expire` | System | status is Claimed and expiry has elapsed | `Claimed -> Expired` | make the claimed invitation unavailable |

## Invariants

| Rule | Constraint |
| --- | --- |
| `one-workspace` | An invitation belongs to exactly one Workspace for its complete lifetime |
| `one-claimant` | At most one Persistent User may claim an invitation |
| `proof-before-response` | Accept and Decline require the current User to be the proven claimant |
| `membership-once` | Acceptance creates or activates at most one Membership for the User and Workspace |
| `terminal-is-final` | Accepted, Declined, Revoked, and Expired invitations cannot transition again |
| `address-is-not-proof` | Matching email or provider data never silently links Users or grants Workspace access |

## Implementation checkpoint

The first executable slice realizes the owner side of the lifecycle through
`AtlasWorkspace.invite`. Atlas persists a Pending invitation addressed either to an exact linked
User or to a stable GitHub provider account ID, exposes owner-scoped administration reads, and
shows Pending or Claimed feedback beside the discovered contributor. Creating the invitation does
not create Membership.

Recipient discovery, identity proof, Claim, Accept, Decline, Revoke, and expiry enforcement remain
shaped durable behavior rather than implemented runtime behavior. They continue in
`plans/current/159-workspace-invitations-end-to-end.md` instead of being approximated by UI-only
state.
