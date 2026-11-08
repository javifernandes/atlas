# 145. Workspace Source Durable Import Experience

Status: current

Definition level: implementation

## Summary

Make Workspace Source import asynchronous, durable, observable, and non-blocking by consuming
Ontahí Durable Operations rather than extending Atlas with a custom queue or worker model. A user
can add several repositories, continue onboarding while imports run, see progress from Workspace
home or Settings, receive completion/failure feedback, retry failures, and remove a Source without
letting stale work republish it.

## Context

Atlas currently registers a Source and performs first reconciliation synchronously. Large
repositories can hold the onboarding UI for many seconds. Atlas already persists
`AtlasWorkspaceSourceImport` rows for History and webhook provenance, but those rows must not grow
into a second Task Runtime with custom lifecycle, progress, polling, leases, or worker semantics.

BookOps already proves GitHub Markdown import through Ontahí Durable Operations and Vercel
Workflow. Atlas should consume the same framework lifecycle while retaining ownership of Source
configuration, Workspace projection publication, import History, removal behavior, and UX.

Related work:

1. [`Workspace Source Reconciliation And History`](../current/144-workspace-source-reconciliation-and-history.md)
2. [`Workspace Sources And Contributor Discovery`](../current/140-workspace-sources-and-contributor-discovery.md)
3. `ontahi://plans/167-durable-task-subject-discovery-and-lifecycle-reactions`
4. `ontahi://plans/132-durable-invocation-identity-and-idempotency`
5. `ontahi://plans/153f-queue-backed-task-runtime`
6. `bookops://plans/46-stream-runtime-and-durable-workflow-architecture`

## Scope

1. Declare Workspace Source reconciliation as an Ontahí Durable Operation with typed input,
   progress, eventual result, and failure.
2. Return `TaskRunRef` immediately after Source registration and let onboarding continue.
3. Execute through persistent Task Storage and a provider-backed runtime such as Vercel Workflow.
4. Observe the same run from onboarding, Workspace home, Settings, and History using standard
   Ontahí React/Runtime Transport APIs.
5. Show per-Source `queued`, `importing`, `ready`, and `failed` presentation with retry.
6. Publish an immutable Workspace projection only after all active Sources converge and the
   accepted Source configuration revision remains current.
7. Project completed/failed domain Events into lightweight in-app feedback.
8. Remove a Source from desired configuration, preserve its History, and trigger convergence
   without it.
9. Migrate `AtlasWorkspaceSourceImport` so it retains domain provenance and projection lineage but
   no longer duplicates Task lifecycle authority.

## Non-Goals

1. Do not implement a queue, lease table, worker endpoint, polling DTO, or task runtime in Atlas.
2. Do not expose Source cancellation until Ontahí provides an enforceable runtime capability.
3. Do not infer rollback of repository reads or external effects.
4. Do not build a general notification center; begin with import outcome feedback derived from
   domain Events.
5. Do not implement Workspace invitations or Membership administration.

## Proposed Experience

```text
Add repository
  -> Source appears immediately as Importing
  -> Add button becomes progress/status
  -> user may add another repository or Continue

Workspace home
  -> current imported graph remains usable
  -> importing Sources appear as status affordances
  -> successful completion refreshes the projection

Settings / History
  -> queued/running progress
  -> completed revision or typed failure
  -> Retry and Remove actions

Import outcome Event
  -> transient success/failure feedback
  -> failed state remains discoverable after toast disappears
```

## Domain And Execution Boundary

Atlas owns:

1. desired Workspace Source configuration and its revision;
2. which active Sources form one converged projection;
3. immutable Workspace projection publication;
4. import trigger/provenance and History presentation;
5. Source removal and stale-publication rejection;
6. recipient-facing copy and navigation.

Ontahí owns:

1. Task acceptance and `TaskRunRef`;
2. queued/running/terminal lifecycle and timestamps;
3. typed progress, result, and run failure;
4. durable storage, executor adaptation, restart, and observation;
5. provider-neutral Event occurrence/delivery semantics;
6. enforced idempotency and future cancellation capabilities.

## Execution Slices

### Slice 1 — Source removal and configuration fencing

- [ ] Add owner-authorized Source removal as desired-configuration mutation.
- [ ] Preserve Source identity and import History after removal.
- [ ] Introduce a stable Workspace Source configuration revision.
- [ ] Reject projection publication from a run whose accepted configuration was superseded.
- [ ] Trigger convergence of the remaining active Source set.

### Slice 2 — Durable import declaration

- [x] Define typed import input and eventual result; typed progress and Task-level failures remain.
- [x] Bind each convergence run to its Workspace through Ontahí's subject contract.
- [ ] Execute repository loading and projection building through the selected durable runtime.
- [x] Return `TaskRunRef` before import completion.
- [ ] Reuse or skip duplicate triggers through an enforced Ontahí idempotency policy.

### Slice 3 — non-blocking onboarding and observation

- [x] Let repository selection continue while several imports are active.
- [x] Let `Continue` leave onboarding without waiting.
- [ ] Render queued/importing/failed/ready status on Workspace home and Settings.
- [ ] Resume observation after navigation, reload, or a second browser session.
- [ ] Refresh the Workspace projection only after successful terminal completion.

### Slice 4 — Events, feedback, and History migration

- [ ] Emit typed completion/failure Events with Task Run, Source, trigger, and projection causality.
- [ ] Show outcome feedback without making a transient toast the only failure record.
- [ ] Retain trigger/delivery/revision/projection lineage in Atlas History.
- [ ] Remove status, progress, timing, and error authority duplicated from Task snapshots.
- [ ] Verify manual, connection, push, and merged-PR trigger paths.

## Acceptance Checklist

- [ ] Adding a repository returns control before its import completes.
- [ ] Several repositories may import concurrently without blocking Continue.
- [ ] Workspace home and Settings show the same durable run state.
- [ ] Reload/navigation resumes observation of the same Task Run.
- [ ] A successful run advances only its Workspace projection.
- [ ] A failed run preserves the previous projection and remains retryable.
- [ ] A removed Source disappears from desired configuration and stale work cannot republish it.
- [ ] Repeated provider delivery starts or reuses work according to enforced idempotency.
- [ ] History retains domain provenance without becoming a custom task runtime.
- [ ] Atlas contains no custom queue, worker protocol, lease, or task polling DTO.

## Verification

1. Domain tests for Source removal, configuration revision, and stale publication rejection.
2. Durable runtime integration tests covering acceptance, progress, restart, success, and failure.
3. React tests for non-blocking onboarding and observation across route changes.
4. Cross-Workspace isolation and duplicate webhook delivery tests.
5. Event/feedback tests proving durable failure remains visible after transient UI feedback.
6. Production adapter proof using a repository large enough to outlive the initiating request.

## Decisions

1. Atlas is a consumer of Ontahí durable execution, not an owner of execution infrastructure.
2. Source removal mutates desired configuration and fences stale publication; it does not pretend to
   cancel work that Ontahí cannot yet cancel honestly.
3. Task snapshot is lifecycle state, Event occurrence is a fact, and notification is an Atlas
   presentation projection.
4. Current imported data remains usable while a newer reconciliation runs.
5. History preserves Atlas domain lineage but delegates execution lifecycle to Ontahí.
6. A reconciliation converges the complete active Source set, so its primary Task subject is the
   Workspace. The triggering Source remains Atlas provenance rather than Task-discovery identity.

## Implementation Checkpoint — 2026-11-08

Atlas now declares `AtlasWorkspace.reconcileSources` as an Ontahí Durable Operation. Local and test
composition use Ontahí's in-process runtime; PostgreSQL composition persists Task snapshots in the
standard Ontahí Task store. The operation returns a queued `TaskRunRef` immediately, and Atlas can
rediscover runs after losing that ref with bounded `TaskStorage.listBySubject` lookup on the
Workspace subject. Onboarding and manual retry no longer wait for reconciliation to finish.

Workspace Home and Settings now perform that authorized server-side subject lookup on every render
and present the newest recovered run as Workspace sync activity. Queued/running state survives
navigation and reload. Once discovered, Atlas reattaches the run to Ontahí's Durable Operation
observer over Runtime Transport; terminal state updates automatically and refreshes the server
projection without a redundant manual refresh affordance. A registered Source with
no first projection renders as an importing graph node rather than returning to repository setup.
The same desired-configuration overlay applies to later Sources: Atlas keeps the last successful
projection visible and adds an `importing` project node for each registered Source not represented
there yet, regardless of whether it was connected during onboarding or from Settings. No Atlas
polling route or parallel task DTO is involved.

This checkpoint deliberately does not claim production restart durability or live discovery of a
new run that begins while the browser remains open. The next Ontahí capability should let a client
observe the changing set of runs for a subject (or react to Task/Event occurrences); until then,
Atlas uses explicit server refresh rather than custom polling or a second WebSocket. Atlas must
also route webhook-triggered Workspace reconciliation through this same durable operation, add
progress/failure semantics, and select the provider-backed runtime used in production.

## Open Questions

1. Should one Workspace reconciliation run be subject-bound to the Workspace, triggering Source,
   or both through a primary subject plus domain provenance?
2. Can imports for different Sources execute concurrently while one final convergence run publishes
   the complete projection, or should every trigger reconcile the full Source set?
3. What small feedback surface is sufficient before Atlas introduces a persistent notification
   center?
4. Should removal immediately hide imported nodes or retain the last projection until convergence
   without the Source completes?

## Closure / Evolution

This plan closes when Source import and removal are production-usable without blocking onboarding
and all background execution semantics come from Ontahí. Invitations and Membership administration
remain the next separate product slice.
