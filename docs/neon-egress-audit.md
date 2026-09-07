# Neon/PostgreSQL Egress Audit

Date: 2026-09-07
Audited baseline: `origin/main` at `bb4cd1b`
Implementation plan: `plans/done/129-neon-egress-audit-and-containment.md`

## Executive diagnosis

The dominant risk is the dynamic page read. Before this change, every readable request to `/`
executed the latest Projection Revision query and transferred its entire `snapshot_json`. The
configured local Atlas, BookOps, and Ontahi source checkouts currently produce a 4,934,821-byte
snapshot. Only about 1,141 reads of that payload equal the 5,631,125,256 bytes reported by the Neon
project API. Over the reported three-to-four-day incident window, that is only 285-380 readable
requests per day.

Full reconciliation is the second material contributor. Every signed push or merged-Pull-Request
delivery reloads all registered sources and Pull Request evidence, rebuilds the complete dataset,
and reads the prior ~4.93 MB Projection Revision. Before this change it also read all persisted
Source Records, including about 2.51 MB of Markdown content, plus all Item and Plan columns to find
stale IDs. A conservative local lower bound was about 7.77 MB per reconciliation before smaller
reads and protocol overhead. Roughly 725 such runs could explain the current total by themselves.
This is less likely than page traffic unless the three repositories generated hundreds of accepted
push/merge deliveries, but it can plausibly be a significant co-contributor.

The conclusion is therefore:

1. **Primary, critical:** repeated full-snapshot page reads.
2. **Secondary, high:** full webhook reconciliation, including two independent events around many
   merges (`pull_request.closed` and the resulting `push`).
3. **Medium:** explicit manual/rebuild reconciliation, especially because the operator script
   reads the new full snapshot again after committing it.
4. **Low direct / medium indirect:** the six-hour redeploy. It did not reconcile sources, but it
   ran production schema checks and continually replaced warm processes.

Neon defines public network transfer as data sent from the database through its proxy to clients;
database writes and GitHub API responses are not Neon egress. Neon also documents that it does not
provide a per-query byte breakdown and recommends correlating transfer windows with
`pg_stat_statements` row/call data. See [Reduce network transfer costs](https://neon.com/docs/introduction/network-transfer).

## Incident evidence and limitations

### Production control-plane evidence

A read-only `GET /projects/weathered-rain-59323266` through the authenticated Neon CLI returned:

| Metric | Value |
| --- | ---: |
| Consumption period start | 2026-09-02 11:36:40 UTC |
| `data_transfer_bytes` | 5,631,125,256 bytes (5.63 GB / 5.24 GiB) |
| Project logical replication | disabled |
| PostgreSQL version | 18 |

Logical replication can therefore be excluded as the source of this incident. The database
connection now fails with `Your project has exceeded the data transfer quota`, so exact production
table aggregates and `pg_stat_statements` could not be collected without changing the plan or
waiting for the quota to reset. No production mutation was attempted.

Run `pnpm db:traffic` after access is restored. It reports aggregate-only counts and byte estimates
for the latest snapshot, Source Records, the old reconciliation inventory reads, and the new page
cache hit/miss paths. Then collect statement frequency with:

```sql
SELECT
  query,
  calls,
  rows AS total_rows,
  rows / NULLIF(calls, 0) AS avg_rows_per_call
FROM pg_stat_statements
WHERE query ILIKE '%projection_revisions%'
   OR query ILIKE '%atlas_source_records%'
ORDER BY calls DESC;
```

`pg_stat_statements.rows` is not a byte measurement, but its call count will distinguish repeated
page reads from reconciliation. Stats may be empty after a suspended compute restarts; establish a
representative observation window before drawing conclusions.

### Reproducible local measurement

The measurement loaded the configured local source checkouts without GitHub Pull Request evidence,
normalized their Markdown, built the real Ontahi dataset, and measured UTF-8 output.

| Measurement | Value |
| --- | ---: |
| Source Records | 478 |
| Source content | 2,513,336 bytes |
| Serialized Source Record rows | 2,831,233 bytes |
| Projection snapshot | 4,934,821 bytes |
| Serialized Projection Revision row | 5,085,023 bytes |
| Snapshot nodes / edges | 313 / 1,268 |
| Items / Plans | 129 / 294 |

The serialized-row values are application-side JSON approximations, not PostgreSQL wire captures;
escaping makes them conservative. Column `octet_length` from `pnpm db:traffic` is the preferred
production estimate once the compute is available.

## Architecture and traffic paths

```text
Browser request
  -> force-dynamic app/page.tsx
  -> getAtlasRequestAccess()
  -> getAtlasPageData()
  -> latest revision-id check -------------------------> Neon (tiny SELECT)
  -> cache miss only: Ontahi latest revision read -----> Neon (~4.93 MB)
  -> cached snapshot + per-user Session projection

GitHub push or merged Pull Request
  -> signed /api/ingress/github/webhook
  -> Ontahi ingress operation
  -> loadAtlasProjectionInput()
       -> all registered Markdown ---------------------> GitHub, not Neon egress
       -> all configured PR evidence ------------------> GitHub, not Neon egress
  -> build full Ontahi dataset in the Next.js process
  -> serialized PostgreSQL transaction
       -> delivery and latest-revision reads ----------> Neon egress
       -> upsert full dataset --------------------------> Neon ingress/write traffic
       -> delete identities absent from current sets
       -> insert full Projection Revision
  -> invalidate local snapshot cache + revalidate `/`
```

The GitHub `next` cache is only an application/provider cache. It can reduce repeated GitHub tree,
blob, and Pull Request responses, but it does not cache PostgreSQL results and did not prevent the
page from reading `ProjectionRevision.snapshotJson` on every request.

The composition cache in `src/atlas/server/atlas-composition.ts` previously cached only the
constructed application object and connection pool. Calling a method on that object still entered
the Ontahi PostgreSQL runtime, which has no result cache. It therefore did not reduce snapshot
transfer.

## Ontahi SQL behavior

Atlas's selection at `src/atlas/domain/atlas-application.ts:1536` asks for only `id` and
`snapshotJson`. That selection controls the JavaScript result shape. It does **not** control SQL
projection in `@ontahi/postgres` 1.0.0-alpha.11.

The published adapter's `columnsFor(mapping, spec)` enumerates every entry in
`mapping.columns`; `compilePostgresQuery()` uses that list for every non-count root query. The
effective page SQL is therefore equivalent to:

```sql
SELECT
  id, trigger, source_revision_set_hash, snapshot_json, diagnostics_json,
  started_at, completed_at, status
FROM projection_revisions
WHERE TRUE
ORDER BY started_at DESC
LIMIT 1;
```

Likewise, `AtlasSourceRecord.all().run()` returned `id`, all provenance/path fields, `record_kind`,
`content`, and `content_hash`. Replacing `.all()` with `.select(record => ({ id: record.id }))`
would still transfer `content` in alpha.11. The same over-selection applies to every current
Ontahi root read, including Session and webhook helper reads.

Canonical upstream location: `ontahi://packages/postgres/src/data-graph/sql.ts`.

## Path-by-path audit

Estimates use the measured local corpus. “All mapped” reflects the verified alpha.11 compiler, not
an assumption about `.select()`.

| Trigger and code path | SQL / entities | Fields returned | Approximate result bytes per trigger | Expected frequency | Monthly impact example | Severity |
| --- | --- | --- | ---: | --- | ---: | --- |
| Public readable page: `src/app/page.tsx:9`, `src/atlas/server/get-atlas-page-data.ts:17` | Before: latest `ProjectionRevision`; now: narrow revision head plus cached latest revision on miss | Before/full miss: all 8 revision fields, dominated by `snapshot_json`; hit: `id` only | Before: ~4.94 MB every request. Now: ~47 payload bytes plus protocol overhead on a hit; ~4.94 MB per cold/revision miss | Every readable request | Before: 100/day = 14.8 GB/month; 1,000/day = 148 GB/month | **Critical** before; low after containment |
| Authenticated page Session projection: `src/atlas/domain/atlas-application.ts:1574-1660`, `:1721-1794` | 3-4 `atlas_execution_streams` roots, per-stream fork relation reads, roots, activities, then referenced Plans and PRs | All mapped columns for every root despite selections; activities limited to 50, recent/archived Streams bounded to 20 each, open Streams unbounded | Expected KBs for current cardinality; grows with Streams/activity | Every authenticated readable request | Small beside snapshot, but repeated and partly N+1 | **Medium** query-efficiency risk; low incident attribution |
| Push webhook: `src/atlas/domain/atlas-application.ts:854-870` -> `src/atlas/server/load-atlas-projection.ts:9` -> persistence transaction | `WebhookDelivery` upsert/read; latest `ProjectionRevision`; inventory upserts/deletes; new revision insert | Delivery read: all mapped fields; latest revision: all 8 fields. Before fix: all Item, Plan, and Source Record fields too | Before: >=~7.77 MB read lower bound. After: ~4.94 MB prior revision plus small delivery reads | Every accepted push for every registered repository | 10/day before ~= 2.33 GB/month; 50/day ~= 11.65 GB/month | **High** |
| Merged-PR webhook: `src/atlas/domain/atlas-application.ts:746-762` | Same full reconciliation, plus auth-account, prior-activity, and user Stream reads | All mapped fields for each root query | Slightly above push path; dominated by same 4.94/7.77 MB figures | Every accepted merged PR; often accompanied by a distinct push delivery | Same order as push; two reconciliations around one merge are plausible | **High** |
| Manual reconciliation: `scripts/atlas-reconcile.ts:13-25` | Same reconciliation without delivery read; script then calls `getProjectionSnapshot()` | Prior revision plus post-commit full snapshot; before fix also broad inventories | Before: roughly 12.7 MB; after: roughly 9.9 MB, excluding small reads | Operator initiated, normally rare | 100 runs ~= 1.27 GB before | **Medium** per call, normally low frequency |
| Explicit rebuild | Same as manual with `trigger='rebuild'`; it still performs a full source observation and full dataset replacement | Same | Same order as manual | Recovery only | Frequency-dependent | **Medium** |
| Six-hour redeploy: former `.github/workflows/refresh-sources.yml` schedule | Vercel build executes migrations and schema verification, not `loadAtlasProjectionInput()` | Schema/migration metadata; no Projection Revision page read in the workflow itself | Small direct result; process replacement creates later cache misses | Formerly 4/day / ~120/month | Low direct; amplifies cold-cache behavior | **Low direct / medium indirect** |
| Plan-link proposal: `src/atlas/persistence/postgres-application.ts:362-365` | `atlasSourceRecordsQuery` | All mapped Source Record columns; content is actually used to generate the proposal | ~2.83 MB for current corpus | Explicit proposal operation only | Frequency-dependent | **Medium**, but semantically required until indexed proposal input exists |

### Database reads in one reconciliation

The transaction performs these reads; writes/deletes that return no rows are omitted from egress
totals:

1. Webhook only: read the just-upserted `WebhookDelivery` to deduplicate it.
2. Read latest `ProjectionRevision`, including the full previous `snapshot_json`. The snapshot is
   used only when an evidence source failed, but alpha.11 returns it on successful runs too.
3. Before this change: read every `AtlasItem`, `AtlasPlan`, and `AtlasSourceRecord` to compute stale
   IDs in JavaScript. Source Record `content` was transferred and discarded for this purpose.
4. Merged PR with an attributable GitHub identity: read matching `AtlasAuthAccount`, prior
   `AtlasExecutionStreamActivity`, and all Streams for the user.

The current change removes item 3 entirely. It expresses stale cleanup as Ontahi commands whose
predicates are the negation of the current identity set, so PostgreSQL computes the deletion and
returns no record payload.

## Transfer model and root-cause ranking

Let `S = 4,934,821` bytes (current snapshot), `R = 2,831,233` bytes (serialized Source Records),
and `T = 5,631,125,256` observed transfer bytes.

```text
Page-only equivalent:                 T / S       = ~1,141 reads
Old reconciliation lower bound:      T / (S + R) = ~725 runs
Reported 3-day page rate:             ~380 reads/day
Reported 4-day page rate:             ~285 reads/day
```

The page explanation needs only modest traffic and matches the code exactly: dynamic render, no
PostgreSQL cache, one multi-megabyte row. Reconciliation requires a much higher event rate, but all
three repositories can emit push deliveries and a merge can emit both accepted webhook kinds.
Without statement call counts, “page plus reconciliation” remains possible and should be treated
as the operational assumption.

The production API also reports logical replication disabled. No repository workflow performs
`pg_dump`, and the reviewed scheduled workflow only invoked a Vercel deployment hook. Those common
Neon transfer causes are not supported by the evidence.

## Implemented containment

### Version-aware snapshot cache

`src/atlas/persistence/projection-snapshot-cache.ts` stores one parsed snapshot per warm server
process. `src/atlas/persistence/postgres-application.ts:231` checks only:

```sql
SELECT id
FROM projection_revisions
ORDER BY started_at DESC
LIMIT 1;
```

If that ID matches the cached revision, no snapshot bytes leave Neon. Concurrent misses for the
same revision share one full read. After any successful reconciliation,
`src/atlas/persistence/postgres-application.ts:631` invalidates the local value and revalidates the
page. Other warm instances detect the new revision ID on their next request and refresh, preserving
cross-instance correctness without broadcasting process memory.

A Next.js `unstable_cache` entry was evaluated but not used. The installed Next.js 14 runtime's
stock Data Cache rejects entries over 2 MB while this snapshot is about 4.93 MB. Next.js documents
`unstable_cache` as the cache for non-`fetch` database functions and tag invalidation as the
on-demand freshness mechanism, but the current payload needs either a custom cache handler or a
smaller projection before that is safe. See the [Next.js 14 caching documentation](https://nextjs.org/docs/14/app/building-your-application/data-fetching/fetching-caching-and-revalidating).

### Database-side stale deletion

`src/atlas/persistence/postgres-application.ts:523-549` now emits three conditional
`DELETE ... WHERE NOT (id IN (...))` commands through Ontahi. This removes the broad Item, Plan,
and Source Record result sets and keeps deletion inside the serialized reconciliation transaction.

### Query observations

`src/atlas/persistence/postgres-observability.ts` wraps both pool and transaction-client queries.
In production it logs one metadata-only JSON record per successful query:

```json
{
  "event": "atlas.postgres.query",
  "query": "select.projection_revisions.<stable-hash>",
  "statement": "select",
  "table": "projection_revisions",
  "operation": "atlas.page.read",
  "trigger": "public-page",
  "rowCount": 1,
  "payloadBytes": 4935020,
  "durationMs": 18.4
}
```

`payloadBytes` is the UTF-8 size of the parsed result serialized as JSON. It is intentionally an
approximation, but it is stable enough to rank operations and alert on regressions. SQL values and
row contents are never logged. Set `ATLAS_POSTGRES_DIAGNOSTICS=off` for an emergency opt-out;
non-production environments default off unless explicitly enabled.

### Redeploy schedule

The scheduled trigger was removed from `.github/workflows/refresh-sources.yml`; manual dispatch is
retained. Plan 116 described the schedule as a temporary fallback until hosted webhook cutover was
verified, and its closure records that verification. It is no longer part of source freshness.

## Recommended work

### P0: stop runaway transfer — implemented here

- Keep the full snapshot out of unchanged page requests through revision-aware caching.
- Explicitly invalidate after reconciliation and detect revision changes across instances.
- Remove the obsolete six-hour deployment schedule.
- Deploy as soon as the project is upgraded or its quota resets; code changes cannot resume a
  compute already suspended by quota.

### P1: observability and query efficiency — first slice implemented here

- Keep metadata-only query observations enabled in production and aggregate by `query`,
  `operation`, and `trigger`.
- Run `pnpm db:traffic` and capture `pg_stat_statements` after access resumes.
- Fix Ontahi SQL projection so `.select(...)` emits only required physical columns. The compiler
  must include fields needed by predicates, ordering, relation joins, and derived expressions, then
  add adapter tests proving a wide unselected field is absent from SQL and wire results.
- Add a first-class Ontahi storage observer. The graph runtime already receives read `scope`, but
  alpha.11 does not pass scope/entity/operation metadata to the PostgreSQL executor. A reusable
  hook should receive query identity, entity/table, scope, row count, approximate result bytes,
  duration, and failure outcome without Atlas parsing SQL.
- Narrow the latest reconciliation read to revision metadata and load the prior snapshot only on
  the degraded-evidence branch. This awaits correct Ontahi projections or a small upstream
  projection primitive.

### P2: incremental reconciliation — design only

1. Resolve the webhook repository to one registered `sourceId` and observe only that source's tree
   at the delivered revision.
2. Upsert/delete only Source Records and semantic rows owned by that source.
3. For merged PRs, refresh evidence only for the affected repository and merge it with retained
   evidence from other sources.
4. Derive the new compatibility snapshot from partitioned current state or maintain a smaller
   revisioned read projection; do not reload every Markdown body merely to change one source.
5. Coalesce the merge `pull_request.closed` and resulting `push` when they name the same source
   revision, while retaining delivery-level deduplication.
6. Preserve full `rebuild` as the explicit recovery and convergence proof.

## Ontahi abstraction gaps

1. **Physical projection:** `.select()` must constrain root SQL columns. This is the direct cause
   of discarded Source Record content and over-wide Session/helper reads.
2. **Storage telemetry:** graph read scope and entity identity must reach a generic adapter observer.
   Atlas's pool wrapper is a small interim seam, not the desired final ownership boundary.
3. **Conditional large-field loading:** reconciliation needs revision metadata on every run but the
   previous snapshot only during degraded evidence recovery. Ontahi needs efficient reusable
   projections before Atlas should replace that path with ad hoc SQL.

Database-side stale deletion is **not** an abstraction gap: Ontahi already expresses the required
predicate and delete command, and the implemented fix uses that capability.

## Verification and rollout

1. Run `pnpm verify` and the PostgreSQL integration suite.
2. Upgrade the Neon plan or wait for the consumption period reset; the current compute cannot serve
   even read-only verification queries.
3. Deploy the containment change.
4. Run `pnpm db:traffic` once, without printing credentials.
5. Observe query logs for at least one normal traffic window. An unchanged page should show one
   tiny `SELECT id` and no full-row Projection Revision result after the process is warm.
6. Compare the Neon project `data_transfer_bytes` slope before and after. At a 47-byte revision ID,
   5 GB corresponds to roughly 100 million row payloads rather than about one thousand snapshots;
   protocol overhead and cold misses will dominate long before that theoretical count.
7. Reconcile one signed webhook and verify that the next readable page refreshes the snapshot once,
   then returns to revision-head-only reads.
