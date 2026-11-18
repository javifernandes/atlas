---
id: spec-workstream-atlas.access-identity.workspace.respond-to-invitation
kind: interaction
title: Respond To Workspace Invitation
parent: spec-workstream-atlas.access-identity.workspace.manage-contributors
scope:
  entity: AtlasWorkspaceInvitation
  binding: invitation
status: shaping
horizon: now
typeOf:
  - spec-workstream-atlas.atlas-model.interaction
relatedPlans:
  - plans/current/149-interaction-model-v0.md
  - plans/current/140-workspace-sources-and-contributor-discovery.md
  - plans/current/142-workspace-administration-settings.md
---

## Goal

Let the intended recipient understand and deliberately accept or decline a Workspace invitation
after proving the identity required by its addressing path.

## Actors

| Actor                | Participation                                                |
| -------------------- | ------------------------------------------------------------ |
| Invitation Recipient | Proves control, claims the invitation, and chooses a response |

## Context

| Requirement                                                      |
| ---------------------------------------------------------------- |
| A pending Workspace invitation can be located                    |
| The invitation has not expired or been revoked                   |
| An authenticated Atlas User exists or sign-in is available       |
| Claiming the invitation has not yet granted Workspace Membership |
| A known-User claim requires the same authenticated User ID       |
| A GitHub claim requires the linked stable provider account ID    |
| An email claim requires the invitation secret, not account matching |

## Presents

| Information              | Source                                                        |
| ------------------------ | ------------------------------------------------------------- |
| Inviting Workspace       | Workspace invitation                                          |
| Inviting owner           | invitation provenance and active owner Membership             |
| Proposed role            | Workspace invitation intent                                   |
| Addressing path          | known User, observed provider identity, or verified email     |
| Required identity proof  | claim policy selected when the invitation was created         |
| Expiry and current status | Workspace invitation lifecycle                               |
| Current claim state      | unclaimed, claimed by current User, or incompatible claimant  |

## Affordances

| Affordance                 | Kind     | Target                                                                                                          |
| -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| Sign in or switch account  | stimulus | authentication ingress                                                                                          |
| Prove required identity    | stimulus | account linking or invitation-secret ingress                                                                    |
| Claim invitation           | invokes  | [[spec-workstream-atlas.access-identity.workspace.invitation.claim\|Claim Workspace Invitation]]                |
| Accept invitation          | invokes  | [[spec-workstream-atlas.access-identity.workspace.invitation.accept\|Accept Workspace Invitation]]              |
| Decline invitation         | invokes  | [[spec-workstream-atlas.access-identity.workspace.invitation.decline\|Decline Workspace Invitation]]            |

## Steps

| Step                               | Kind     | Target                                                                                                        |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Inspect invitation                 | presents | Workspace invitation intent and lifecycle                                                                    |
| Authenticate as an Atlas User      | stimulus | authentication ingress                                                                                        |
| Prove the addressed identity       | stimulus | User identity, linked provider identity, or invitation secret                                                |
| Bind invitation claim              | invokes  | [[spec-workstream-atlas.access-identity.workspace.invitation.claim\|Claim Workspace Invitation]]             |
| Accept or decline                  | branch   | recipient choice                                                                                              |
| Grant accepted access              | invokes  | [[spec-workstream-atlas.access-identity.workspace.invitation.accept\|Accept Workspace Invitation]]           |
| Close declined invitation          | invokes  | [[spec-workstream-atlas.access-identity.workspace.invitation.decline\|Decline Workspace Invitation]]         |

## Identity Proof Paths

| Addressed recipient        | Required proof                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Known Atlas User           | Authenticated User ID equals the invitation target                                                                 |
| Observed GitHub identity   | A linked External Identity proves the same provider and stable provider account ID                                  |
| Verified email             | The invitation secret proves mailbox control, then binds the claim to the authenticated User without merging accounts |

Provider login, mutable email, and profile similarity are presentation evidence only. None may
silently link Atlas Users, claim an invitation, or create Membership.

## Operation Responsibilities

| Responsibility             | Operation                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Bind proven recipient      | [[spec-workstream-atlas.access-identity.workspace.invitation.claim\|Claim Workspace Invitation]]                  |
| Create accepted Membership | [[spec-workstream-atlas.access-identity.workspace.invitation.accept\|Accept Workspace Invitation]]                |
| Record explicit refusal    | [[spec-workstream-atlas.access-identity.workspace.invitation.decline\|Decline Workspace Invitation]]              |

Claim verifies that a pending invitation and the authenticated User satisfy the addressing proof;
it does not grant Workspace access. Accept requires that claim and creates or activates Membership
atomically. Decline closes the invitation without creating Membership. Expiry and owner revocation
are lifecycle changes that this Interaction observes rather than recipient affordances.

## Outcomes

| Outcome                    | Meaning                                                                    | Continues With                                                       |
| -------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Invitation accepted        | Membership is active with the invited role                                 |                                                                      |
| Invitation declined        | Invitation is closed and no Membership is created                          |                                                                      |
| Invitation unavailable     | Invitation expired, was revoked, or no longer satisfies Workspace policy   |                                                                      |
| Identity proof refused     | Current User cannot claim the addressed invitation                         |                                                                      |
| Response abandoned         | Invitation remains pending until another lifecycle transition              |                                                                      |

The invitation link, email click, OAuth callback, and sign-in form are stimuli or realization
details. They may carry the actor into this Interaction, but they are not substitutes for claim or
acceptance Operations.
