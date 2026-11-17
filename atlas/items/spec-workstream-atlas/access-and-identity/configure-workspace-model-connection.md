---
id: spec-workstream-atlas.access-identity.workspace.configure-model-connection
kind: interaction
title: Configure Workspace Model Connection
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
  - plans/current/158-workspace-model-connections.md
  - plans/current/141-read-only-plan-assistant.md
---

## Goal

Use a Workspace-owned model provider for model-backed Operations without exposing its credential.

## Actors

| Actor           | Participation                                                   |
| --------------- | --------------------------------------------------------------- |
| Workspace Owner | Configures and governs the model connection                     |
| Workspace Member | Uses model-backed Operations without receiving the credential |

## Context

| Requirement                                                        |
| ------------------------------------------------------------------ |
| The current User has an active Workspace Membership                |
| Only a Workspace Owner may configure or disable the connection     |
| Server-side secret storage may be available or honestly unavailable |
| Deployment model configuration may remain active as a fallback     |

## Presents

| Information              | Source                                   |
| ------------------------ | ---------------------------------------- |
| Connection status        | AtlasWorkspaceModelConnection            |
| Provider and model       | AtlasWorkspaceModelConnection            |
| Optional endpoint        | AtlasWorkspaceModelConnection            |
| Safe credential hint     | AtlasWorkspaceModelConnection            |
| Active configuration form | Workspace or deployment fallback        |
| Secret-store availability | host capability, without secret details |

## Affordances

| Affordance             | Kind    | Target                                  |
| ---------------------- | ------- | --------------------------------------- |
| Configure connection   | invokes | AtlasWorkspace.configureModelConnection |
| Replace credential     | invokes | AtlasWorkspace.configureModelConnection |
| Disable connection     | invokes | AtlasWorkspace.disableModelConnection   |
| Ask about Plans        | invokes | AtlasWorkspace.askPlans                 |

## Steps

| Step                              | Kind     | Target                                  |
| --------------------------------- | -------- | --------------------------------------- |
| Inspect current model connection  | presents | AtlasWorkspaceModelConnection            |
| Submit provider configuration     | stimulus | confidential model-connection ingress   |
| Store credential outside Graph    | support  | SecretStore                             |
| Persist safe connection metadata  | invokes  | AtlasWorkspace.configureModelConnection |
| Use connection for a Plan question | invokes | AtlasWorkspace.askPlans                 |

## Outcomes

| Outcome                            | Meaning                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| Workspace connection active        | Model-backed Operations resolve the Workspace connection       |
| Existing connection preserved      | Failed replacement leaves the previous usable connection intact |
| Connection disabled                | Workspace configuration is inactive; migration fallback may run |
| Configuration unavailable          | The form explains missing host secret-storage capability       |
| Configuration refused              | The current User is not an active Workspace owner              |

## Experimental Service Blueprint

This view aligns actor-visible behavior with the semantic and technical support that realizes it.
It is an experiment for Interaction Model v1, not a second authoritative workflow definition.

| Stage | Actor action | Frontstage / evidence | Semantic behavior | Backstage and support | Durable state / failure |
| --- | --- | --- | --- | --- | --- |
| Inspect | Opens Models settings | Provider, model, endpoint, status, safe key hint | Present Workspace model connection | Authorized safe-metadata read | Connection, fallback, unavailable, or refused |
| Configure | Selects provider and model, enters API key | Confidential form; the key is never displayed again | Configure Workspace model connection | Owner reauthorization; secret-write ingress; `SecretStore.put` | New metadata becomes active only after secret storage succeeds |
| Compensate | Sees a safe failure | Existing configuration remains visible | Preserve previous connection | Delete newly written secret if metadata persistence fails | No partial replacement or newly orphaned secret |
| Disable | Confirms disabling the connection | Disabled status and fallback explanation | Disable Workspace model connection | Owner reauthorization; metadata transition; secret cleanup policy | Workspace connection disabled |
| Use | Asks a question about Plans | Answer, citations, pending and failure states | Invoke `AtlasWorkspace.askPlans` on the Workspace receiver | Resolve connection; `SecretStore.get`; invoke provider; record Resource evidence | Workspace-scoped usage or safe typed failure |

## Realization Evidence

| Interaction element | Semantic target | Current realization |
| --- | --- | --- |
| Inspect connection | `AtlasWorkspace.readModelConnection` | Models settings section and confidential model-connection `GET` ingress |
| Configure or replace | `AtlasWorkspace.configureModelConnection` | Models form and confidential model-connection `PUT` ingress |
| Disable | `AtlasWorkspace.disableModelConnection` | Models status control and confidential model-connection `DELETE` ingress |
| Persist safe metadata | `AtlasWorkspaceModelConnection` | Ontahí Entity mapped to `atlas_workspace_model_connections` |
| Store or resolve credential | `atlas.secret-store` Resource | Doppler `SecretStore` adapter with service Resource evidence |
| Use configured model | `AtlasWorkspace.askPlans` | Per-invocation provider resolver keyed by the canonical Workspace receiver |

The secret-write ingress is intentionally not the semantic Operation. It owns confidential
transport and compensation, then internally invokes the server-only Operation with safe metadata.
The Models component is one realization of this Interaction rather than its durable identity.
