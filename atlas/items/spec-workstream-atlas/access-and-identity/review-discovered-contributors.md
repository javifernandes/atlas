---
id: spec-workstream-atlas.access-identity.workspace.review-discovered-contributors
kind: interaction
title: Review Discovered Contributors
parent: spec-workstream-atlas.access-identity.workspace
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
| Access status        | [[spec-workstream-atlas.access-identity.workspace\|Workspace access]] |

## Affordances

| Affordance          | Kind    | Target                                                                                                                  |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| Inspect contributor | inspect | Observed Contributor                                                                                                    |
| Invite contributor  | opens   | [[spec-workstream-atlas.access-identity.workspace.invite-person-to-workspace\|Invite Person To Workspace]]             |
| Open member         | opens   | [[spec-workstream-atlas.access-identity.workspace.manage-membership\|Manage Membership]]                               |

## Outcomes

| Outcome                         | Meaning                                   |
| ------------------------------- | ----------------------------------------- |
| Candidate selected for invite   | Continues with the invitation Interaction |
| Existing access inspected       | No membership mutation is required        |
| Review completed without action | The Workspace remains unchanged           |
