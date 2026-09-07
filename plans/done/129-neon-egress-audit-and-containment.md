# 129. Neon Egress Audit And Containment

Status: done

## Summary

Identify the PostgreSQL result paths responsible for exhausting Atlas's Neon public-network
transfer allowance, stop repeated transfer of the multi-megabyte Projection Revision snapshot,
and leave byte-level query diagnostics that make a recurrence visible from application logs.

## Context

The Neon project reported 5,631,125,256 transferred bytes between 2026-09-02 and 2026-09-07 and
now rejects PostgreSQL connections because the free-plan quota is exhausted. A reproduction from
the configured local source checkouts produces a 4,934,821-byte projection snapshot and 2,513,336
bytes of source Markdown across 478 records. The production page is dynamic and currently reads
the latest snapshot on every request.

Ontahi PostgreSQL alpha.11 also compiles every mapped root column even when a query uses
`.select(...)`. Selection shapes therefore constrain materialization but not database egress. The
immediate Atlas fix must avoid broad reads entirely where possible and record the reusable Ontahi
projection/telemetry gap rather than hiding it.

## Research / Evidence

- `src/app/page.tsx` marks `/` as `force-dynamic`.
- `src/atlas/server/get-atlas-page-data.ts` calls `getProjectionSnapshot()` for every readable page.
- `ProjectionRevision.snapshotJson` is about 4.93 MB for the currently configured local corpus.
- `AtlasSourceRecord.content` totals about 2.51 MB before row metadata and protocol overhead.
- `@ontahi/postgres` alpha.11 `columnsFor(...)` emits every mapped column for root reads.
- A read-only production aggregate could not run after suspension, so production table sizes and
  statement statistics remain a post-upgrade/reset verification step.

## Scope

- Document page, reconciliation, webhook, redeploy, and manual database-read paths.
- Add a version-aware server snapshot cache with explicit post-reconciliation invalidation.
- Push stale Item, Plan, and Source Record deletion into PostgreSQL through Ontahi commands.
- Add metadata-only PostgreSQL query diagnostics and an aggregate traffic diagnostic command.
- Disable the obsolete six-hour automatic redeploy while preserving manual dispatch.

## Non-Goals

- Do not implement incremental source or Pull Request reconciliation in this slice.
- Do not prune Projection Revision history.
- Do not patch or publish Ontahi from the Atlas repository.
- Do not claim exact production per-query bytes while the suspended compute cannot expose them.

## Proposed Form

### P0: stop runaway transfer

1. Cache a parsed snapshot in each server process, keyed by a narrow latest-revision identity read.
2. Re-read the full snapshot only on cold start or revision change.
3. Invalidate the local cache and the page after successful reconciliation.
4. Remove the scheduled redeploy trigger that creates avoidable cold deployments.

### P1: observability and query efficiency

1. Replace read-all-and-diff stale detection with Ontahi `DELETE ... WHERE NOT (...)` commands.
2. Log query identity, table, row count, approximate payload bytes, duration, and trigger context.
3. Add a read-only diagnostic command for current snapshot/source/table byte estimates.
4. Upstream an Ontahi fix so root SQL projection follows `.select(...)` and storage telemetry
   receives graph scope/entity metadata without SQL parsing.

### P2: incremental reconciliation

Use webhook source identity and revision to reload only the affected repository, update only its
records/evidence, and derive a new Projection Revision from changed source partitions. Keep full
rebuild as an explicit recovery operation.

## Execution Slices

1. Trace and measure the existing paths; publish `docs/neon-egress-audit.md`.
2. Land cache containment, direct stale deletion, query diagnostics, and the diagnostic script.
3. Add focused unit/integration coverage and run the full application verification contract.

## Verification

- [x] Repeated unchanged snapshot reads perform one full Projection Revision read.
- [x] Successful reconciliation invalidates the snapshot cache.
- [x] Stale-record reconciliation performs no `SELECT` from `atlas_source_records`.
- [x] Query diagnostics report metadata without SQL values or returned content.
- [x] The aggregate diagnostic command typechecks and documents the suspended-production caveat.
- [x] `pnpm verify` passes.

## Decisions

1. Use a tiny revision-head read for cross-instance correctness because the current ~4.93 MB
   snapshot exceeds stock Next.js 14's 2 MB Data Cache entry limit.
2. Keep full snapshot materialization behind Ontahi; the narrow raw revision-head query is one
   isolated workaround for the verified Ontahi projection gap.
3. Delete stale identities with Ontahi commands rather than adding more raw SQL.
4. Enable metadata-only query diagnostics by default in production, with an explicit opt-out.

## Open Questions

1. How many production requests came from bots versus authenticated use?
2. How many webhook deliveries and Projection Revisions exist in production?
3. Should the compatibility snapshot be split into smaller viewer projections after containment?

## Closure / Evolution

### 2026-09-07 — containment complete

The audit traced dynamic page reads, authenticated Session reads, signed webhook reconciliation,
manual rebuilds, and scheduled deployments from current `main`. The configured corpus measured a
4,934,821-byte snapshot and 2,513,336 bytes of Source Record content; the Neon control plane
reported 5,631,125,256 transferred bytes and a suspended compute.

Atlas now caches a parsed snapshot behind a narrow revision-head check, invalidates it after
reconciliation, deletes stale identities inside PostgreSQL without reading inventories, emits
metadata-only query observations, and exposes `pnpm db:traffic`. The obsolete six-hour redeploy
schedule was removed while manual dispatch remains. Unit/type/build verification passed, and the
nine-case persistence integration suite passed against an isolated local PostgreSQL schema.

Production `pg_stat_statements` and exact table measurements remain a rollout check after the quota
resets or the project is upgraded. Incremental source/evidence reconciliation and the reusable
Ontahi physical-projection/telemetry changes remain P2/P1 evolution documented in the audit.
