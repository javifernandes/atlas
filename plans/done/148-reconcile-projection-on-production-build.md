# 148. Reconcile Projection On Production Build

Status: done
Advances: spec-workstream-atlas.goal.legible-system-evolution

## Summary

Recompile Atlas's durable Projection Revision with the newly built application semantics before a
successful production deployment is promoted.

## Context

PR #71 introduced `kind: goal` and the `advances` relation. Its merge webhook reached the previous
production deployment before Vercel promoted the new parser. That deployment observed the new Goal
source but normalized the unknown kind through the old `capability` fallback, then persisted that
snapshot. The later deployment knew the new semantics but did not reconcile automatically, leaving
the page on a valid yet semantically stale Projection Revision.

Production builds already migrate and verify PostgreSQL before compiling. They need one additional
post-build convergence step for source/parser changes that do not require a schema migration.

## Scope

1. Run normal projection reconciliation after a successful production build.
2. Preserve the existing migrate, workspace-backfill, verify, and build ordering.
3. Keep preview and local builds free of persistent reconciliation.
4. Test the production and non-production command sequences without accessing a database.
5. Document deployment-time semantic reconciliation as part of Projection Revision lifecycle.

## Non-Goals

1. Do not change the PostgreSQL schema.
2. Do not reconcile before compilation succeeds.
3. Do not make page reads mutate or lazily rebuild projections.
4. Do not replace webhook reconciliation; deployment reconciliation is its semantic-version safety
   net.

## Proposed Form

```text
production build
  migrate -> backfill workspaces -> verify schema -> build -> reconcile projection -> promote

preview/local build
  build
```

The reconciliation remains serialized and transactional through the existing PostgreSQL lock. It
observes authoritative sources again and commits a new Projection Revision only after the new code
has compiled successfully.

## Execution Slices

1. [x] Add post-build production reconciliation to `scripts/vercel-build.sh`.
2. [x] Add an executable command-order regression test.
3. [x] Update Projection Revision and persistence documentation.
4. [x] Verify the application and close this plan.

## Verification

1. Production invokes `db:migrate`, `db:backfill:workspaces`, `db:verify`, `build`, then
   `db:reconcile` in that order.
2. Preview and local environments invoke only `build`.
3. A failed build cannot start reconciliation.
4. `pnpm verify` passes.

## Decisions

1. Reconcile after build, not before it, so a non-compiling semantic change cannot publish a new
   Projection Revision.
2. Keep reconciliation inside the production deployment gate rather than on a page read.
3. Treat semantic source/parser compatibility like schema compatibility: every deployed compiler
   must converge its durable read model.

## Closure / Evolution

Closed on 2026-11-15. Production reconciliation run 43774150973 rebuilt the stale Goal projection
successfully. Future Vercel production builds now reconcile after compilation, while executable
tests prove the exact production order, the preview boundary, and the failed-build boundary.
