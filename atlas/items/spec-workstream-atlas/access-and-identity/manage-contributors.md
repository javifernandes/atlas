---
id: spec-workstream-atlas.access-identity.workspace.manage-contributors
kind: interaction
title: Manage Contributors
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
  - plans/current/142-workspace-administration-settings.md
---

## Goal

Understand who participates in a Workspace and deliberately manage who receives explicit access.

## Actors

| Actor           | Participation                                               |
| --------------- | ----------------------------------------------------------- |
| Workspace Owner | Reviews participation evidence and manages explicit access |

## Context

| Requirement                                  |
| -------------------------------------------- |
| A Workspace is selected                      |
| Current User may manage Workspace membership |

## Presents

| Information                  | Source                                               |
| ---------------------------- | ---------------------------------------------------- |
| Observed contributors        | repository participation projections                 |
| Current members              | active Workspace Memberships                         |
| Pending invitations          | Workspace invitation lifecycle records               |
| Identity and evidence status | linked External Identities and contribution evidence |

## Affordances

| Affordance                     | Kind  | Target                                                                                                              |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------- |
| Review discovered contributors | opens | [[spec-workstream-atlas.access-identity.workspace.review-discovered-contributors\|Review Discovered Contributors]] |
| Invite a person                | opens | [[spec-workstream-atlas.access-identity.workspace.invite-person-to-workspace\|Invite Person To Workspace]]         |
| Manage existing access         | opens | [[spec-workstream-atlas.access-identity.workspace.manage-membership\|Manage Membership]]                           |

## Steps

| Step | Actor action                               | System response                                              |
| ---- | ------------------------------------------ | ------------------------------------------------------------ |
| 1    | Reviews observed contributors and members | Presents participation evidence separately from access state |
| 2    | Chooses a contributor or person           | Opens the appropriate review or invitation Interaction       |
| 3    | Chooses an existing member                | Opens membership management for that Workspace relationship  |

## Outcomes

| Outcome                              | Meaning                                                      |
| ------------------------------------ | ------------------------------------------------------------ |
| Contributor review opened            | Continues with Review Discovered Contributors                |
| Invitation path opened               | Continues with Invite Person To Workspace                    |
| Existing membership opened           | Continues with Manage Membership                             |
| Management completed without changes | Workspace access and participation projections remain intact |

`Manage Contributors` composes actor-facing work; it does not own membership mutation rules.
Invitation and membership Operations remain authoritative for applicability, authorization,
effects, failures, and invariants.
