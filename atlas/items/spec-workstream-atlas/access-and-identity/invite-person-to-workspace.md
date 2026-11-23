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

## Activity

```atlas-activity
activity:
  entry: invitation-begun
  actors:
    workspace-owner:
      label: Workspace Owner
      description: The member choosing one intended recipient and the access Atlas should offer.
      context:
        - ref: spec-workstream-atlas.access-identity.workspace
          label: Workspace
  nodes:
    invitation-begun:
      kind: stimulus
      label: Begin invitation
      actor: workspace-owner
      responsibility: actor
    addressing-path:
      kind: decision
      label: How is the recipient addressed?
      actor: workspace-owner
      responsibility: actor
    choose-known-user:
      kind: activity
      label: Choose a known Atlas User
      actor: workspace-owner
      responsibility: actor
      reads:
        - ref: spec-workstream-atlas.access-identity.user
          label: Persistent User
    choose-observed-identity:
      kind: activity
      label: Choose an observed GitHub identity
      actor: workspace-owner
      responsibility: actor
      reads:
        - ref: spec-workstream-atlas.access-identity.external-identity
          label: Observed External Identity
    enter-email-address:
      kind: activity
      label: Enter an email delivery address
      actor: workspace-owner
      responsibility: actor
    recipient-addressed:
      kind: merge
      label: Recipient address selected
    invitation-eligibility:
      kind: decision
      label: Can this recipient be invited?
      responsibility: system
      reads:
        - ref: spec-workstream-atlas.access-identity.workspace.membership
          label: Active Workspace Membership
        - ref: spec-workstream-atlas.access-identity.external-identity
          label: External Identity evidence
    choose-access:
      kind: activity
      label: Choose proposed access
      actor: workspace-owner
      responsibility: actor
      presents:
        - ref: spec-workstream-atlas.access-identity.workspace
          label: Collaborator or viewer role and invitation expiry
    invite:
      kind: operation
      label: Invite
      ref:
        ref: spec-workstream-atlas.access-identity.workspace.invitation.invite
        label: Invite
    pending-invitation-created:
      kind: outcome
      label: Pending invitation created
    existing-access-discovered:
      kind: outcome
      label: Existing access discovered
    recipient-cannot-be-addressed:
      kind: outcome
      label: Recipient cannot be addressed
    invitation-creation-refused:
      kind: outcome
      label: Invitation creation refused
    invitation-abandoned:
      kind: outcome
      label: Invitation abandoned
  transitions:
    - id: invitation-requested
      from: invitation-begun
      to: addressing-path
      trigger: Workspace Owner chooses to invite a person
    - id: known-user-selected
      from: addressing-path
      to: choose-known-user
      branch: Known User
      affordance: Find Atlas User
    - id: observed-identity-selected
      from: addressing-path
      to: choose-observed-identity
      branch: GitHub identity
      affordance: Choose observed contributor
    - id: email-path-selected
      from: addressing-path
      to: enter-email-address
      branch: Email
      affordance: Enter email address
    - id: invitation-cancelled-before-addressing
      from: addressing-path
      to: invitation-abandoned
      branch: Cancel
      affordance: Cancel invitation
    - id: known-user-addressed
      from: choose-known-user
      to: recipient-addressed
      result: target Atlas User ID selected
    - id: observed-identity-addressed
      from: choose-observed-identity
      to: recipient-addressed
      result: provider and stable provider account ID selected
    - id: email-addressed
      from: enter-email-address
      to: recipient-addressed
      result: delivery address and secret-based claim policy selected
    - id: recipient-ready-for-validation
      from: recipient-addressed
      to: invitation-eligibility
    - id: recipient-eligible
      from: invitation-eligibility
      to: choose-access
      branch: Eligible
      guard: recipient can be addressed and has no equivalent Workspace access
    - id: recipient-already-member
      from: invitation-eligibility
      to: existing-access-discovered
      branch: Existing access
      guard: target Atlas User already has equivalent active Membership
    - id: recipient-address-unsupported
      from: invitation-eligibility
      to: recipient-cannot-be-addressed
      branch: Cannot address
      guard: target identity or delivery path is incomplete or ambiguous
    - id: access-chosen
      from: choose-access
      to: invite
      affordance: Invite
    - id: invitation-created
      from: invite
      to: pending-invitation-created
      result: pending invitation intent is durably recorded
    - id: invitation-refused
      from: invite
      to: invitation-creation-refused
      result: authorization or Workspace invitation policy refused creation
```

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
| Email invitation path   | owner-provided delivery address and recipient proof requirement |
| Proposed Workspace role | invitation intent; not an active Membership                    |
| Claim requirement       | identity proof required before the invitation can bind a User |
| Expiry and status       | Workspace invitation lifecycle                                |

## Affordances

| Affordance                     | Kind    | Target                                                                                                          |
| ------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------- |
| Choose a known Atlas User      | inspect | Persistent User                                                                                                 |
| Choose an observed contributor | inspect | Observed GitHub identity                                                                                        |
| Enter an email delivery address | stimulus | invitation recipient input                                                                                    |
| Invite                         | invokes | [[spec-workstream-atlas.access-identity.workspace.invitation.invite\|Invite]]                                  |

## Steps

| Step                               | Kind     | Target                                                                                                      |
| ---------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| Address a known Atlas User         | inspect  | Persistent User                                                                                             |
| Address an observed GitHub identity | inspect | Observed GitHub identity                                                                                    |
| Address an email delivery path     | stimulus | invitation recipient input                                                                                  |
| Choose proposed access             | presents | collaborator or viewer role and expiry                                                                     |
| Invite                              | invokes  | [[spec-workstream-atlas.access-identity.workspace.invitation.invite\|Invite]]                              |

## Operation Responsibilities

| Responsibility        | Operation                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Record the invitation | [[spec-workstream-atlas.access-identity.workspace.invitation.invite\|Invite]]                                      |
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
