---
id: spec-workstream-atlas.access-identity.workspace.review-discovered-contributors
kind: interaction
title: Review Discovered Contributors
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
---

## Goal

Decide which observed contributors should receive explicit Workspace access.

## Activity

```atlas-activity
activity:
  entry: review-opened
  actors:
    workspace-owner:
      label: Workspace Owner
      description: The member deciding whether observed repository participation should lead to explicit Workspace access.
      context:
        - ref: spec-workstream-atlas.access-identity.workspace
          label: Workspace
  nodes:
    review-opened:
      kind: stimulus
      label: Begin contributor review
      actor: workspace-owner
      responsibility: actor
    load-candidates:
      kind: activity
      label: Load contributor evidence
      responsibility: system
      reads:
        - ref: spec-workstream-atlas.access-identity.workspace
          label: Workspace Sources and Memberships
    candidates-available:
      kind: decision
      label: Contributors require review?
      responsibility: system
      reads:
        - ref: spec-workstream-atlas.access-identity.user
          label: Linked Atlas Users
    choose-contributor:
      kind: activity
      label: Choose a contributor to review
      actor: workspace-owner
      responsibility: actor
    inspect-evidence:
      kind: activity
      label: Inspect contributor evidence
      actor: workspace-owner
      responsibility: actor
      reads:
        - ref: spec-workstream-atlas.access-identity.external-identity
          label: Linked External Identity
      presents:
        - ref: spec-workstream-atlas.access-identity.user
          label: Linked Atlas User
    next-action:
      kind: decision
      label: What should happen next?
      actor: workspace-owner
      responsibility: actor
    invite-contributor:
      kind: interaction
      label: Invite Person To Workspace
      ref:
        ref: spec-workstream-atlas.access-identity.workspace.invite-person-to-workspace
        label: Invite Person To Workspace
    candidate-selected:
      kind: outcome
      label: Candidate selected for invite
    review-completed:
      kind: outcome
      label: Review completed without action
  transitions:
    - id: review-requested
      from: review-opened
      to: load-candidates
      trigger: Workspace Owner chooses to review contributors
    - id: evidence-loaded
      from: load-candidates
      to: candidates-available
      result: observed participation is reconciled with linked Users and active Memberships
    - id: candidates-found
      from: candidates-available
      to: choose-contributor
      branch: "Yes"
      guard: at least one observed contributor has no Workspace access
    - id: no-candidates-found
      from: candidates-available
      to: review-completed
      branch: "No"
      guard: every observed contributor already has Workspace access
    - id: contributor-selected
      from: choose-contributor
      to: inspect-evidence
      affordance: Inspect contributor
    - id: evidence-inspected
      from: inspect-evidence
      to: next-action
    - id: invitation-requested
      from: next-action
      to: invite-contributor
      branch: Invite
      affordance: Invite contributor
    - id: another-review-requested
      from: next-action
      to: choose-contributor
      branch: Review another
      affordance: Choose another contributor
    - id: review-finished
      from: next-action
      to: review-completed
      branch: Done
      affordance: Finish review
    - id: invitation-interaction-opened
      from: invite-contributor
      to: candidate-selected
      result: invitation Interaction owns recipient proof and membership intent
```

## Actors

| Actor           | Participation                                  |
| --------------- | ---------------------------------------------- |
| Workspace Owner | Primary actor reviewing possible collaborators |

## Context

| Requirement                                  |
| -------------------------------------------- |
| At least one Source is connected             |
| Contributor evidence has been reconciled     |
| Current User may manage Workspace membership |

## Presents

| Information          | Source                                                                  |
| -------------------- | ----------------------------------------------------------------------- |
| Observed contributor | contributor participation projection                                    |
| Evidence summary     | registered Sources and merged Pull Requests                             |
| Identity status      | linked External Identity and Atlas User                                 |
| Access status        | [Workspace access](spec-workstream-atlas.access-identity.workspace)    |

## Affordances

| Affordance          | Kind    | Target                                                                                                                  |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| Inspect contributor | inspect | Observed Contributor                                                                                                    |
| Invite contributor  | opens   | [[spec-workstream-atlas.access-identity.workspace.invite-person-to-workspace\|Invite Person To Workspace]]             |

## Outcomes

| Outcome                         | Meaning                                   |
| ------------------------------- | ----------------------------------------- |
| Candidate selected for invite   | Continues with the invitation Interaction |
| Review completed without action | The Workspace remains unchanged           |

The current Settings realization is read-only. It filters out contributors whose linked Atlas User
already has active Workspace Membership, presents grouped repository participation evidence, and
links to the external GitHub profile. Opening the invitation Interaction is modeled product intent,
not an implemented Settings affordance yet.
