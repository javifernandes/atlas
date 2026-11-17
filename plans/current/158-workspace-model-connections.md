# 158. Workspace Model Connections

Status: current

Definition level: implementation

## Summary

Let a Workspace owner configure the model provider used by Workspace-scoped model-backed
Operations without storing provider credentials in Atlas PostgreSQL or exposing them through the
Ontahí Runtime Protocol. Persist safe connection metadata in Atlas, store secret material behind a
replaceable `SecretStore`, and resolve the `ModelProvider` for each Operation invocation from the
canonical Workspace receiver.

The first host adapter uses one dedicated Doppler config. Doppler is an implementation choice, not
part of the Atlas or Ontahí semantic model.

## Context

Plan 141 intentionally began with one deployment-configured provider. Ontahí alpha.20 now makes
the `AtlasWorkspace` Entity Ref the canonical receiver of `askPlans`, so provider resolution can be
scoped by semantic Operation identity instead of UI state or an ambient selected Workspace.

A provider API key is not an ordinary Operation input. Bridged Operation requests and local
Devtools may retain complete inputs for debugging, so sending `apiKey: string` through that channel
would disclose secret material. Atlas therefore needs two related boundaries:

1. a narrow authenticated secret-write ingress that never records or returns the value;
2. ordinary semantic Operations and Entities that carry only safe metadata and an opaque secret
   reference.

## Model

`AtlasWorkspaceModelConnection` is persistent Workspace-owned configuration:

```text
id                 stable connection identity
workspaceId        owning Workspace
purpose            plans-assistant (v0)
provider           openai | anthropic
model              provider model identifier
baseUrl            optional non-secret endpoint override
secretRef          opaque reference understood only by the configured SecretStore
secretSuffix       optional safe display hint
status             active | disabled
createdAt
updatedAt
```

The secret value never appears in Graph fields, Operation inputs or outputs, logs, diagnostics,
resource evidence, or client-readable configuration.

## Execution

```text
owner settings form
  -> authenticated secret-write ingress
      -> authorize active Workspace owner
      -> SecretStore.put(opaque name, provider API key)
      -> configure safe ModelConnection metadata
      -> compensate by deleting the new secret if metadata persistence fails

AtlasWorkspace.askPlans(receiver = workspace ref)
  -> authorize active Workspace membership
  -> load active connection for (workspace, plans-assistant)
  -> SecretStore.get(secretRef)
  -> construct provider adapter for this invocation
  -> execute modelOperation and emit ordinary Resource evidence
  -> deployment provider fallback while migration remains open
```

## Secret Store Boundary

```ts
type SecretStore = {
  put(ref: string, value: string): Promise<void>;
  get(ref: string): Promise<string>;
  delete(ref: string): Promise<void>;
};
```

The Doppler adapter uses a write-enabled Service Token restricted to one dedicated config. On the
Developer plan that config-scoped token is acceptable for this pilot, but all secrets in that
config share its blast radius. Atlas must keep the adapter replaceable by a tenant-oriented vault
without changing the Workspace model.

## Scope

1. Author `Configure Workspace Model Connection` as a Workspace-scoped Interaction.
2. Use an experimental Service Blueprint to align actor actions, visible evidence, semantic
   behavior, backstage support, external Resources, durable state, and failure paths.
3. Add the provider-neutral `SecretStore` contract and a tested Doppler adapter.
4. Add the persistent Workspace Model Connection and migration.
5. Add owner-only read/configure/disable behavior without returning secret values.
6. Resolve `askPlans` provider per invocation from its Workspace receiver.
7. Add a Models section to Workspace Settings with replace, disable, and safe status states.
8. Preserve deployment configuration as an explicit fallback during migration.

## Non-Goals

1. No conversation memory, agent runtime, checkout, or tool execution.
2. No budgets, quotas, billing, or general authorization framework.
3. No arbitrary provider parameter bag; v0 supports provider, model, and optional base URL.
4. No secret value read-back, reveal, or browser hydration.
5. No claim that Doppler is the final multi-tenant secret system.
6. No model failover, A/B selection, or multiple simultaneous connections per purpose.

## Slices

### Slice 0 — Interaction and blueprint experiment

- [x] Author `Configure Workspace Model Connection` using Interaction Model v0.
- [x] Add a first Service Blueprint reading without making implementation details authoritative.
- [x] Bind implemented Operations, ingress, Entity, Resource, and UI realization as they land.
- [x] Compare the designed and realized interaction before proposing Interaction Model v1 fields.

### Slice 1 — secret boundary

- [x] Add `SecretStore` and typed failures.
- [x] Add and test the Doppler adapter without logging request bodies or provider responses.
- [x] Read Doppler host configuration only on the server.

### Slice 2 — durable safe metadata

- [x] Add `AtlasWorkspaceModelConnection` and PostgreSQL migration.
- [x] Enforce one connection per Workspace and purpose.
- [x] Expose only safe status metadata to authorized Workspace owners.

### Slice 3 — owner configuration ingress

- [x] Add a narrow authenticated route for secret writes.
- [x] Reauthorize active Workspace ownership on every mutation.
- [x] Store the secret first and compensate if metadata persistence fails.
- [x] Never echo, log, diagnose, or serialize the submitted secret.

### Slice 4 — dynamic model-backed Operation

- [x] Replace composition-time provider capture with Ontahí's per-input provider resolver.
- [x] Resolve connection and secret from the `AtlasWorkspace` receiver.
- [x] Retain deployment provider fallback until Workspace setup is complete.
- [x] Keep existing model Resource usage evidence provider-neutral.

### Slice 5 — Workspace Settings

- [x] Add Models to the settings navigation.
- [x] Show provider, model, endpoint, status, and safe credential hint only.
- [x] Support configure/replace and disable for owners.
- [x] Explain deployment fallback and unavailable secret storage honestly.

## Verification

- [x] No API key appears in Runtime Protocol diagnostics or Graph data.
- [x] A non-owner cannot inspect or mutate model connection metadata.
- [x] A Workspace connection cannot be used by another Workspace.
- [x] Replacing a credential does not expose the previous or new value.
- [x] Doppler failures produce typed, non-secret errors.
- [x] `askPlans` resolves the provider belonging to its canonical receiver.
- [x] Existing deployment configuration continues to work during migration.
- [x] `pnpm verify` passes.

## 2026-11-17 implementation contrast

The realized vertical preserved the actor-facing Interaction while separating one important
boundary more strongly than a conventional blueprint usually does: the confidential HTTP ingress
accepts the plaintext credential, but the semantic `configureModelConnection` Operation accepts
only an opaque secret reference and safe metadata. The ingress is therefore realization and
security infrastructure, not the domain behavior itself.

The Service Blueprint proved useful as a projection because it exposed the order of external and
durable effects, compensation after metadata failure, deployment fallback, and Resource evidence
without forcing those concerns into Interaction v0. `realizedBy`, `usesResource`, and durable-state
bindings remain candidates for typed implementation evidence rather than required Interaction
fields.

## Decisions

1. The Workspace owns safe Model Connection metadata; it does not own plaintext credentials.
2. Provider resolution is per Operation invocation and derived from the receiver.
3. Secret writes use a confidential ingress, not an observable bridged Operation input.
4. Doppler is the first `SecretStore` adapter, not the semantic abstraction.
5. The first purpose is `plans-assistant`; purpose remains explicit so later Operations can choose
   different models without a generic untyped settings bag.

## Interaction Model Experiment

Plan 158 is the second grounded Interaction Model exemplar after contributor review and the first
to shape behavior before its complete realization exists. It deliberately combines a familiar
Service Blueprint projection with Atlas semantic identities. The Interaction remains actor-facing;
the blueprint aligns that experience with backstage Operations, ingresses, Resources, external
systems, durable state, failures, and evidence.

This experiment must not introduce a generic diagram editor or make table cells authoritative over
Entities and Operations. Descriptive workshop material may remain loose, while claims that a
semantic behavior or realization exists should eventually resolve to an Atlas identity or remain a
visible gap.
