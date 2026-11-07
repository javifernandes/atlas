# 144. Workspace Source Reconciliation And History

Status: current

Definition level: implementation

## Summary

Turn registered Workspace Sources into an observable, Workspace-partitioned projection. Connecting
a repository must lead to a reconciliation execution that resolves an exact provider revision,
imports Atlas documents, and publishes a projection visible only inside that Workspace. Workspace
Settings must expose the execution history so an owner can understand which repository event or
manual action produced the current form and why a change is missing.

## Context

Atlas now lets an authenticated owner create a Workspace and register several GitHub repositories.
Registration is desired configuration only: non-default Workspaces still render an empty state and
the existing reconciliation pipeline writes one global projection. Invoking that pipeline for a
new Workspace would let tenants overwrite each other.

Atlas already records global `ProjectionRevision` rows for bootstrap, rebuild, catch-up, and webhook
reconciliation. Those rows establish useful invariants—exact source revisions, start/completion
times, diagnostics, and immutable published snapshots—but they are not scoped to a Workspace and do
not represent pending or failed executions. This plan preserves those ideas while introducing a
Workspace-owned execution boundary.

Related work:

1. [`Atlas Adoption Foundation`](136-atlas-adoption-foundation.md)
2. [`Workspace Sources And Contributor Discovery`](140-workspace-sources-and-contributor-discovery.md)
3. [`Dynamic Workspace Onboarding`](143-dynamic-workspace-onboarding.md)
4. [`Reconciliation`](../../atlas/items/spec-workstream-atlas/atlas-model/reconciliation.md)
5. [`Workspace`](../../atlas/items/spec-workstream-atlas/access-and-identity/workspace.md)

## Research / Evidence

1. `AtlasWorkspaceSource` is Workspace-owned, while source records, Items, Plans, and
   `ProjectionRevision` currently belong to one compatibility projection.
2. The existing loader resolves GitHub refs to tree SHAs and attaches the exact revision to every
   imported Markdown file.
3. The current PostgreSQL reconciler serializes global writes and publishes an immutable snapshot
   only after convergence succeeds.
4. Dogfooding showed that repository registration without visible import state looks successful
   even when the Workspace remains empty.
5. A future cancellation UX requires an execution record before it can expose progress or request
   compensation.

## Scope

1. Define a Workspace-owned Source import execution with trigger, repository, exact revision,
   lifecycle state, timestamps, diagnostics, and failure information.
2. Reconcile active Sources into a Workspace-partitioned projection without mutating another
   Workspace projection.
3. Trigger the first import from repository connection and allow an owner to retry manually.
4. Render recent import history in Workspace Settings.
5. Serve the latest completed Workspace projection from `/w/:slug`.
6. Migrate the canonical Atlas Workspace from the global compatibility projection onto the same
   partitioned form as every other Workspace.
7. Bind every GitHub Source to the Atlas GitHub App installation that authorizes observation.

## Non-Goals

1. Do not implement generic Ontahi durable-operation rollback in this plan.
2. Do not infer automatic compensation for arbitrary mutations or external effects.
3. Do not implement BYOK or dynamic model configuration.
4. Do not add invitations or contributor admission.
5. Do not remove full rebuild as the convergence and disaster-recovery proof.

## Proposed Form

```text
Source registered / manual retry / provider event
  -> Workspace Source Import execution (pending -> running)
  -> resolve every active Source to an exact revision
  -> parse and derive one Workspace projection candidate
  -> publish immutable Workspace projection revision
  -> execution completed | failed
  -> Settings history explains trigger, revisions, duration, diagnostics
```

The execution and published projection are distinct. A failed execution remains visible but never
replaces the last completed projection. The first implementation may execute synchronously behind
the bridge; its durable record and lifecycle must not assume the request itself is the eventual
worker boundary.

The initial trigger vocabulary is `connection`, `manual`, `push`, and `pull-request`. Provider
events record their delivery or commit/PR reference when known. A connection-triggered execution
identifies the newly registered Source but reconciles the full active Source set so cross-source
relations converge together.

## Execution Slices

### Slice 1 — partition and publish

- [x] Add Workspace Source import execution and Workspace projection revision entities.
- [x] Persist the PostgreSQL schema and seed no synthetic history.
- [x] Load active Workspace Sources and resolve exact GitHub tree revisions.
- [x] Build and publish an immutable Workspace snapshot only after successful convergence.
- [x] Serve the latest completed projection for a non-default Workspace.
- [x] Backfill the canonical Atlas Workspace owner, GitHub installation authority, and first
      partitioned projection before removing its read-path exception.

### Slice 2 — trigger and history UX

- [x] Trigger reconciliation after repository registration without making registration rollback on
      an import failure.
- [x] Add an owner-authorized manual retry Operation.
- [x] Route GitHub push and merged-PR events to every registered Workspace Source that matches the
      repository, preserving delivery and commit/PR trigger provenance.
- [x] Replace human OAuth repository access with GitHub App installation repository discovery and
      installation-token imports.
- [x] Persist the provider installation on each registered Source and reject webhook deliveries
      whose installation does not match that Source.
- [x] Show recent executions in Settings with Source/repository, trigger, revision, status,
      timestamps, duration, and diagnostics/error.
- [x] Present execution History as its own Settings surface, separate from Source configuration,
      with provider links for observed Git revisions.
- [ ] Make the empty/onboarding state distinguish registered, importing, failed, and ready.

### Slice 3 — progress, cancellation, and cleanup

- [ ] Move execution behind a durable worker boundary and expose phase/checkpoint progress.
- [ ] Model `cancel-requested`, `cancelled`, and `compensating` separately from failure.
- [ ] Let Source removal request cancellation and retain registration until compensation converges.
- [ ] Declare manual idempotent compensation for partial Atlas projection state.
- [ ] Evaluate which Ontahi-recorded mutations are safely invertible and record external-effect
      compensation as a separate runtime direction.

## Verification

- [x] Two Workspaces importing different Sources cannot observe or replace each other's projection.
- [x] A failed import preserves the previously completed projection.
- [x] A successful execution records every exact Source revision used to publish its snapshot.
- [x] Connecting a repository creates visible history even when import fails.
- [x] Manual retry is owner-authorized and does not create duplicate current projection state.
- [ ] Settings history covers pending/running, completed, failed, and empty states.
- [x] Existing default Workspace webhook, rebuild, and catch-up reconciliation still pass.
- [x] `pnpm verify` passes.

## Decisions

1. Source registration is desired configuration; import execution and published projection are
   separate durable forms.
2. A published Workspace projection is immutable and advances only after full Workspace
   convergence succeeds.
3. The first execution can be synchronous, but its lifecycle model must support a later worker.
4. Cancellation begins as declared manual compensation; automatic inversion is not required.
5. History is product functionality, not only operator logging.
6. The visible projection advances by execution observation/start order, not completion order, so
   an older slow import cannot overwrite a newer observation that completed first.
7. Human OAuth identifies an Atlas User; a GitHub App installation authorizes repository
   discovery, import, and webhook observation. Connecting a Source must never blur those grants.

## Open Questions

1. Should provider pushes coalesce by Workspace, Source, or observed commit when several events
   arrive during one execution?
2. How long should successful and failed execution history be retained?
3. Does Source removal hide its history, retain it under a retired Source, or snapshot repository
   presentation fields directly on every execution?

## Closure / Evolution

The current checkpoint publishes immutable Workspace projection snapshots from active registered
Sources, records exact Source revisions and failures in Workspace-owned import executions, serves
the latest completed snapshot from every dynamic Workspace route, and renders recent execution
history with an owner-authorized retry. Signed provider events fan out by installation and
repository with delivery-level idempotency. Production deployment backfills the canonical Atlas
tenant's owner, installation IDs, and initial partitioned projection before the route reads it as
an ordinary Workspace. Progress and cancellation follow over this same execution identity rather
than introducing a second task model.
