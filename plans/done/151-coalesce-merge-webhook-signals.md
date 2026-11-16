# 151. Coalesce Merge Webhook Signals

Status: done
Advances: spec-workstream-atlas.goal.legible-system-evolution

## Summary

Treat the default-branch `push` and merged `pull_request.closed` deliveries for one merge commit as
two complementary observations of one authoritative revision, not two reasons to rebuild every
Atlas source.

## Context

Plan 150 removed feature-branch pushes and exact delivery redelivery work. A normal GitHub merge
still emits distinct deliveries with distinct IDs. The push carries the authoritative git revision;
the merged-PR event carries evidence directives, author identity, and optional Session routing.
Ignoring either loses semantics, while fully reconciling both roughly doubles compute per merge.

## Scope

1. Detect that the latest projection already contains the webhook's merge revision.
2. Record a same-revision push against the existing Projection Revision without rebuilding.
3. Apply a same-revision merged PR as a narrow evidence and Session-activity revision.
4. Preserve both delivery identities and make arrival order irrelevant.
5. Prove one full projection load for either event order.

## Non-Goals

1. Do not debounce different git revisions.
2. Do not make webhook payloads authoritative for source content.
3. Do not replace recovery or build-time reconciliation.

## Proposed Form

```text
first signal for SHA
  -> full source convergence and Workspace fan-out

second signal for SHA
  push -> bind delivery to existing revision
  merged PR -> append PR evidence and Session activity in a lightweight revision
```

## Execution Slices

- [x] Add same-revision lookup and durable delivery claim.
- [x] Add lightweight merged-PR evidence publication.
- [x] Skip repeated Workspace import for the complementary signal.
- [x] Verify push-first and PR-first ordering.
- [x] Update durable Reconciliation form and run `pnpm verify`.

## Verification

1. `push → pull_request.closed` calls the full projection loader once.
2. `pull_request.closed → push` calls the full projection loader once.
3. Evidence bindings and Session activity exist in both orders.
4. Both provider delivery IDs remain durable.
5. Different revisions still reconcile independently.

## Decisions

1. Coalescing is keyed by repository plus exact git SHA, never a time window.
2. The merged-PR signal remains authoritative only for its own evidence and activity metadata.
3. A lightweight evidence publication creates a new immutable Projection Revision rather than
   mutating the prior snapshot.

## Closure / Evolution

Closed on 2026-11-16. Repository plus exact SHA now identifies complementary merge signals. A
same-revision push binds its delivery to the existing Projection Revision, while a same-revision
merged PR publishes only its Pull Request, evidence bindings, Session activity, and an immutable
snapshot revision that reuses the existing source lineage. Neither complementary signal repeats
Workspace fan-out. Both arrival orders execute exactly one full projection load in PostgreSQL
integration tests. `pnpm verify` and all 13 PostgreSQL integration tests pass.
