---
id: spec-workstream-atlas.access-identity.workspace.invite-person-to-workspace
kind: interaction
title: Invite Person To Workspace
parent: spec-workstream-atlas.access-identity.workspace.manage-contributors
scope:
  entity: AtlasWorkspace
  binding: workspace
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

Offer one person explicit Workspace access without confusing participation evidence, external
identity, invitation delivery, or Membership.

## Actors

| Actor           | Participation                           |
| --------------- | --------------------------------------- |
| Workspace Owner | Chooses the recipient and proposed role |

## Context

| Requirement                                              |
| -------------------------------------------------------- |
| A Workspace is selected                                  |
| Current User may manage Workspace membership             |
| The recipient does not already have equivalent access    |
| The proposed role is collaborator or viewer; ownership transfer is separate |

## Presents

| Information             | Source                                                        |
| ----------------------- | ------------------------------------------------------------- |
| Known Atlas User        | Persistent User search or an already linked contributor       |
| Observed GitHub identity | contributor participation and External Identity projections   |
| Verified email path     | owner-provided delivery address and recipient proof requirement |
| Proposed Workspace role | invitation intent; not an active Membership                    |
| Claim requirement       | identity proof required before the invitation can bind a User |
| Expiry and status       | Workspace invitation lifecycle                                |

## Affordances

| Affordance                     | Kind    | Target                                                                                                          |
| ------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------- |
| Choose a known Atlas User      | inspect | Persistent User                                                                                                 |
| Choose an observed contributor | inspect | Observed GitHub identity                                                                                        |
| Enter a verified email path    | stimulus | invitation recipient input                                                                                     |
| Create invitation              | invokes | [[spec-workstream-atlas.access-identity.workspace.create-invitation\|Create Workspace Invitation]]             |

## Steps

| Step                               | Kind     | Target                                                                                                      |
| ---------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| Address a known Atlas User         | inspect  | Persistent User                                                                                             |
| Address an observed GitHub identity | inspect | Observed GitHub identity                                                                                    |
| Address a verified email path      | stimulus | invitation recipient input                                                                                  |
| Choose proposed access             | presents | collaborator or viewer role and expiry                                                                     |
| Create pending invitation          | invokes  | [[spec-workstream-atlas.access-identity.workspace.create-invitation\|Create Workspace Invitation]]         |

## Operation Responsibilities

| Responsibility        | Operation                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Create pending intent | [[spec-workstream-atlas.access-identity.workspace.create-invitation\|Create Workspace Invitation]]                   |
| Prove and bind claim  | [[spec-workstream-atlas.access-identity.workspace.invitation.claim\|Claim Workspace Invitation]]                    |
| Grant accepted access | [[spec-workstream-atlas.access-identity.workspace.invitation.accept\|Accept Workspace Invitation]]                  |

Creation is owner-authorized and records the intended recipient, role, expiry, and evidence. Claim
binds a still-valid invitation to the authenticated User that proves the required identity.
Acceptance creates or activates Membership only after that claim. Matching email or provider data
must not silently merge Atlas Users or grant access.

## Outcomes

| Outcome                       | Meaning                                                             | Continues With                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Pending invitation created    | Recipient may later prove control and respond                       | [[spec-workstream-atlas.access-identity.workspace.respond-to-invitation\|Respond To Workspace Invitation]]             |
| Existing access discovered    | No duplicate invitation or Membership is created                    |                                                                                                                         |
| Recipient cannot be addressed | Owner may choose another supported path or abandon                   |                                                                                                                         |
| Invitation creation refused   | Current User lacks authority or the proposed access violates policy |                                                                                                                         |
| Invitation abandoned          | Workspace access remains unchanged                                  |                                                                                                                         |

`Invite Person To Workspace` ends when invitation intent is durably created or abandoned. Delivery,
claim, acceptance, decline, expiry, and revocation remain observable lifecycle behavior, but they
do not become hidden steps of the owner's interaction.
