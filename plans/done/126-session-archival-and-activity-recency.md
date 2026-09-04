# 126. Session Archival And Activity Recency

Status: done

Definition level: shaped

Parent plan: [Explicit Session Forking And Activity Routing](./125-explicit-session-forking-and-routing.md)

## Summary

Keep the Sessions workspace useful as personal execution history grows. A User can archive a
Session independently of whether it is open or closed, reveal or hide archived Sessions, and
restore one from the archive. Every Session row shows the timestamp of its last
merged-Pull-Request activity rather than substituting a
lifecycle timestamp.

This plan implements the **Workstream Execution Tree** and shapes the **Execution Stream** and
**Operation Command Interface**.

## Context

Open and recent closed Sessions currently share one bounded rail. Closing creates the temporal
boundary, but there is no later curation step, so completed intervals will accumulate in the
default workspace. The rail also shows close time for historical Sessions and no activity recency
for open Sessions, which makes it harder to distinguish active lines from stale ones.

The projected activity query is deliberately bounded. Deriving each Session's latest activity from
that response would therefore become incorrect as history grows. Atlas needs a durable summary on
the Session itself, updated with ingestion and backfilled once from existing activities.

## Scope

- add nullable `archivedAt` and `lastActivityAt` fields to the Atlas Execution Stream Entity and
  PostgreSQL table;
- backfill `lastActivityAt` from the maximum existing activity timestamp;
- update `lastActivityAt` transactionally whenever merged-PR activity is appended, without
  regressing it for an out-of-order delivery;
- add one ownership-checked bridged Ontahí operation that archives or unarchives a Session;
- keep archive independent from routing lifecycle and make the action reversible;
- automatically unarchive an open Session in the same transaction that appends newly routed
  merged-PR activity;
- load open Sessions, bounded recent unarchived Sessions, and bounded archived Sessions separately;
- hide archived Sessions by default, expose a show/hide control, and preserve direct links to an
  archived Session by revealing the archive automatically;
- show `Last PR <relative time>` or `No PRs yet` on every Session row;
- cover the migration, model mapping, operation, projection, and UI behavior.

## Non-Goals

- deleting Sessions or their activity;
- reopening a closed Session when new PR activity names it;
- combining close and archive into one transition;
- automatically archiving by age, inactivity, or count;
- reconstructing activity recency from Git history or an unbounded page query;
- adding workspace-wide retention policies or collaborator permissions.

## Proposed Form

```text
AtlasExecutionStream
  status: open | closed
  closedAt: timestamp?
  archivedAt: timestamp?       # presentation/history curation; any lifecycle state
  lastActivityAt: timestamp?   # max observed PR activity time

AtlasExecutionStream.setArchived({ id, archived })
  owner + Session -> archivedAt = now | null

routed merged-PR activity + archived open Session
  -> append activity + archivedAt = null in one transaction
```

`status` continues to answer whether activity can route to the Session. `archivedAt` answers whether
the Session appears in the default workspace. Unarchiving restores visibility but does not
reopen routing.

## Execution Slices

1. [x] Register the durable lifecycle and recency semantics in the Execution Stream and Sessions
       experience items.
2. [x] Add the expand-first migration, Ontahí fields, mapping expectations, and ingestion update.
3. [x] Add the authenticated bridged archive/unarchive operation and domain tests.
4. [x] Project bounded archived history and exact `lastActivityAt` values.
5. [x] Add the archive affordance, show/hide control, direct-link behavior, and rail timestamps.
6. [x] Run default and PostgreSQL integration verification, update closure evidence, and move the
       Plan to `done/`.
7. [x] Let open Sessions be archived and automatically resurface them on newly routed activity.

## Verification

- [x] migration applies over existing Sessions, backfills the latest activity, and repeats safely;
- [x] the Ontahí mapping matches `archived_at` and `last_activity_at`;
- [x] only the owning authenticated User can archive or unarchive a Session;
- [x] open and closed Sessions can both be archived without changing routing lifecycle;
- [x] valid merged-PR activity atomically resurfaces an archived open Session;
- [x] archive and unarchive preserve lifecycle status, Plans, roots, focus, and activities;
- [x] merged-PR ingestion advances but never regresses `lastActivityAt`;
- [x] default reads exclude archived Sessions from recent history while keeping a bounded archive;
- [x] the UI hides archived Sessions by default and can reveal, select, and restore them;
- [x] a direct archived Session URL reveals its selected Session;
- [x] every rail row shows the last merged-PR timestamp or `No PRs yet`;
- [x] `pnpm verify`, PostgreSQL integration tests, migration verification, and `git diff --check`
      pass.

## Decisions

1. Archive is reversible curation, not a third routing status.
2. Open or closed Sessions can be archived; closing remains the explicit routing boundary.
3. `lastActivityAt` is a durable denormalized maximum because activity hydration is intentionally
   bounded.
4. Archived data remains queryable and addressable; hiding it is a default view choice.
5. Valid activity automatically resurfaces an archived open Session without changing its routing
   lifecycle; closed Sessions remain closed and unroutable.

## Open Questions

1. Does the archive eventually need text search, or is a bounded revealed list sufficient?
2. Should Atlas later offer a combined `Close and archive` shortcut after this two-step behavior is
   dogfooded?

## Closure / Evolution

Implementation started from direct Sessions dogfood. The originating PR is explicitly routed with
`Atlas-Session: 0d8c5646-6d1b-4fac-af0a-c953fc3121c2`.

### 2026-09-04 — archive and recency landed

Atlas now persists archive state independently from open/closed lifecycle and exposes one
ownership-checked bridged `AtlasExecutionStream.setArchived` operation for reversible curation.
The first UI slice exposed archival on closed Sessions. Reads remain bounded across open, recent
unarchived, and archived groups, while direct archived URLs reveal their selected Session.

`lastActivityAt` is backfilled from the maximum existing activity and advanced transactionally by
new merged-PR ingestion without regressing on out-of-order delivery. The rail renders that exact
summary for open, recent, and archived Sessions, with `No PRs yet` for a fresh fork.

`pnpm verify` passed with 92 default unit/UI tests, typecheck, the production build, and 79 Atlas
source traces. All 8 PostgreSQL integration tests passed against an ephemeral local Postgres 18
container, including prior-schema backfill, bounded projection, and recency behavior. No production
database or production-derived branch was used.

### 2026-09-04 — activity-aware archive follow-up landed

Dogfooding clarified that archive is a visibility preference rather than a lifecycle gate. The
follow-up makes open Sessions archivable and clears `archivedAt` transactionally when a valid
merged PR routes to one, while preserving `closed` as the hard activity boundary.

`pnpm verify` passed with 93 default tests, typecheck, the production build, and 79 Atlas source
traces. All 8 PostgreSQL integration tests passed against an ephemeral local Postgres 18 container,
including explicit `Atlas-Session` routing into an archived open Session and its atomic resurfacing.
