# 156. Adaptive materialization policy

Status: next

## Summary

Make physical persistence, retention, cooling, eviction, and restore behavior declarative over
logical Sources and projections, so storage cost and response guarantees can evolve without
changing Entity semantics.

## Context

Some Atlas state is fully reproducible from Git/provider history; some needs a checkpoint plus
ChangeSets; some is Atlas-owned and cannot be discarded. Current persistence choices are embedded
in tables and reconciliation code rather than expressed as system policy.

## Proposed Form

Materialization policy declares reconstructibility, checkpoint strategy, hot/cold transitions,
retention, restore mechanism, and service objective. Policy may be selected adaptively by activity
or explicitly by Workspace/product tier, but the resulting logical revision remains the same.

```ts
materialization: {
  strategy: "adaptive",
  reconstructFrom: ["source", "checkpoint", "changesets"],
  coolAfter: "15d",
  restore: "checkpoint-plus-replay",
  targetReadyLatency: "2s",
}
```

## Scope

- Reconstructibility and durability classes.
- Checkpoint/compaction policy.
- Hot, warm, cold, restoring, and unavailable operational states.
- Eviction safety proofs and dependency-aware restore.
- Workspace activity and tier policy inputs.
- Observability of restore latency, cost, failures, and cache efficacy.

## Non-Goals

- Pricing decisions.
- A specific elastic-storage vendor.
- Evicting Atlas-owned state without an independent durable authority.

## Execution Slices

1. Classify every current persisted state family.
2. Define policy schema and validation invariants.
3. Implement one safe disposable parsed-artifact tier.
4. Add restore lifecycle and user-visible readiness semantics.
5. Add inactivity-based cooling behind explicit limits.
6. Evaluate product-tier policy only after real cost/latency evidence.

## Verification

- Policy validation rejects eviction without a reconstruction path.
- Restored logical revision matches its pre-eviction identity/content.
- Atlas-owned memberships, Sessions, pending edits, and conflict decisions remain durable.
- Consumers do not depend on whether a revision was hot or reconstructed.

## Closure / Evolution

Not started. Depends on Plans 154 and 155; parent Plan 153.
