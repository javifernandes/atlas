# 150. Contain Webhook Reconciliation CPU

Status: done
Advances: spec-workstream-atlas.goal.legible-system-evolution

## Summary

Keep signed GitHub webhooks as Atlas's primary convergence signal while preventing irrelevant or
already-observed deliveries from paying the cost of a complete source and evidence rebuild.

## Context

Vercel Fluid Compute observability on 2026-11-16 showed that four Atlas ingress invocations used
two minutes of active CPU in twelve hours, while ordinary Atlas page reads used seconds. The
provider currently dispatches every repository `push`, including feature branches, into complete
global and Workspace reconciliation. Durable delivery deduplication also happens only after Atlas
has loaded remote sources and built the candidate dataset, so a redelivery avoids writes but not
the expensive observation and parsing work.

## Research / Evidence

1. `/api/ingress/[...path]` used roughly thirty seconds of active CPU per invocation in the sampled
   Vercel window.
2. GitHub push payloads identify both the pushed ref and the repository default branch.
3. Atlas Sources currently converge their authoritative repository branch; feature-branch pushes
   cannot change the published projection.
4. `webhook_deliveries` already provides the durable identity needed to reject a repeated delivery
   before remote observation.

## Scope

1. Ignore signed pushes whose ref is not the repository default branch.
2. Read durable delivery identity before loading or parsing projection inputs.
3. Preserve the transactional delivery claim as the concurrent-race fence.
4. Avoid cache invalidation and Workspace fan-out for repeated deliveries.
5. Record the operational boundary in the Reconciliation model.

## Non-Goals

1. Do not replace full reconciliation with an incremental projection compiler.
2. Do not debounce distinct authoritative revisions.
3. Do not change build-time reconciliation or manual recovery.
4. Do not alter BookOps compute behavior.

## Proposed Form

```text
signed webhook
  -> reject irrelevant event
  -> ignore non-default-branch push
  -> check durable delivery identity
     -> known: return its existing outcome without observation or fan-out
     -> new: observe sources, build candidate, claim transactionally, publish and fan out
```

## Execution Slices

- [x] Filter non-default-branch pushes at the GitHub ingress boundary.
- [x] Add a pre-observation durable delivery fast path.
- [x] Prove repeated delivery does not call the projection loader.
- [x] Update the Reconciliation system form and operational documentation.
- [x] Run focused tests and `pnpm verify`.

## Verification

1. A signed default-branch push remains accepted.
2. A signed feature-branch or tag push is ignored without dispatch.
3. The second receipt of a delivery returns `duplicate: true` without calling `loadProjection`.
4. Concurrent first receipts remain fenced by the existing transactional claim.
5. Full repository verification passes.

## Decisions

1. Filter by the default branch declared in the signed GitHub payload rather than hard-coding
   `main`.
2. Retain the in-transaction idempotency check because an early read cannot prevent a race.
3. Treat a repeated delivery as a no-op: it does not invalidate presentation caches or create a
   second Workspace import.

## Closure / Evolution

Closed on 2026-11-16. Signed pushes outside the repository default branch now stop at ingress, and
known delivery IDs return their persisted outcome before loading projection input. The existing
transactional claim remains the first-delivery race fence. `pnpm verify` passed; the PostgreSQL
suite also proved the new loader-call assertion, with its separate pre-existing migration inventory
expectation still lagging migrations 018–020.

A later plan may coalesce the distinct default-branch `push` and `pull_request.closed` events for
one merge, but only after evidence and Session activity semantics have an explicit incremental
path.
