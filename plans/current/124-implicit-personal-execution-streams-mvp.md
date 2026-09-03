# 124. Implicit Personal Execution Streams MVP

Status: current

Definition level: shaped

## Summary

Dogfood one narrow execution-memory model in Atlas: each persistent User may have one open
implicit Execution Stream. Merged Pull Requests attributable to that User join the open stream; if
none is open, the next attributable Pull Request creates one automatically. The User may close the
stream explicitly, creating a temporal boundary without changing any Plan status. The next
attributable activity starts a fresh stream.

Sessions renders the stream as a small execution tree over the existing shared Plan lineage, with
its current focus, recent merged-PR activity, and bounded recent history. This is an intentionally
reversible product experiment. Atlas should learn from actual use before adding parallel stream
routing, chat ingestion, or elaborate lifecycle semantics.

This plan implements
[[spec-workstream-atlas.planning-projection.workstream-execution-tree|Workstream Execution Tree]]
and shapes [[spec-workstream-atlas.atlas-model.execution-stream|Execution Stream]].

## Context

Plan execution is recursive rather than linear. Work on a parent exposes a child, implementation
descends into that child, and later work backtracks to an unfinished sibling or ancestor branch.
Map describes durable system structure and Board shows the global set of interventions, but neither
answers which small path a person is currently traversing.

Atlas cannot observe Codex chats or the moment a person mentally switches topics. It can observe a
stable authenticated User, their linked GitHub account, explicit Plan evidence in merged Pull
Requests, and declared parent/child Plan lineage. With multiple simultaneous streams that evidence
is insufficient to route a merge without another annotation. With one implicit open stream it is
enough: all attributable activity joins that stream until the User creates an explicit boundary by
closing it.

The prior broad Personal Workstream Execution Tree proposal combined execution memory, saved
projections, latent targets, materialization, item parts, and collaboration. The Wizard-of-Oz pass
showed a smaller hypothesis worth implementing first. This plan replaces the duplicate Plan 119
number with the next unused Atlas plan number and defers the broader ideas until the basic stream
proves useful.

## Research / Evidence

1. Atlas already persists provider-neutral `AtlasUser` and `AtlasAuthAccount` Entities over Better
   Auth's PostgreSQL tables. GitHub's stable account ID can therefore attribute repository activity
   to an Atlas User without treating login or email as identity.
2. Merged Pull Requests already enter through the Ontahí HTTP ingress, carry explicit
   `Atlas-Implements` / `Atlas-Shapes` directives, and materialize `PullRequest` and
   `EvidenceBinding` records.
3. `AtlasPlan.parentPlanId` already supplies one primary lineage tree while other Plan relations
   remain lateral graph edges.
4. Re-reading repository history on every refresh would conflate projection with event ingestion
   and grow without bound. Execution Stream activity should be appended when the signed webhook is
   processed and queried from PostgreSQL.
5. The Wizard-of-Oz flow made only two moments require explicit intent: closing the current stream
   and routing activity when more than one stream is open. This MVP implements only the first.

## Scope

1. Add Atlas-native `AtlasExecutionStream` and `AtlasExecutionStreamActivity` Ontahí Entities on
   repository-owned PostgreSQL tables.
2. Relate a Stream to its owning `AtlasUser`, one or more inferred root `AtlasPlan` memberships,
   current-focus `AtlasPlan`, and append-only activity; relate each activity to one merged
   `PullRequest` and its primary Plan.
3. Allow at most one open implicit Stream per User while leaving the physical model able to add
   explicit parallel Streams later.
4. Include GitHub's stable provider account ID in merged-PR ingestion and persisted Pull Requests.
5. Attribute only a merged PR whose provider account resolves to an Atlas User and whose directives
   resolve to at least one Plan. Prefer an `implements` Plan as current focus.
6. If no implicit Stream is open, create one rooted at the highest known ancestor of the focused
   Plan. Otherwise append activity, add another root when work is in a disjoint lineage, and move
   current focus within the existing Stream.
7. Add a bridged Ontahí close operation that derives the User from the authenticated runtime
   Principal, verifies ownership, and closes the current Stream without mutating Plans.
8. Add a fixed-height Sessions workspace with a persistent session rail and independently scrolling
   Plan-tree and merged-PR panels. Keep the current Stream title, open state, and close affordance in
   the session rail; let the tree hide done Plans and collapse or expand individual branches. When
   no Stream is open, explain that Atlas is waiting for the next attributable merge.
9. Keep reads bounded to the current Stream plus a small recent-history window. Do not scan Git
   history or rebuild activity during page refresh.

## Non-Goals

1. No simultaneous-stream UI, focus switching, `Atlas-Stream` PR directive, or ambiguous-routing
   queue in this slice.
2. No inference from chat history, local branches, unmerged commits, commit authors, elapsed time,
   browser activity, or arbitrary Markdown edits.
3. No historical backfill. The first Stream begins with attributable activity observed after this
   implementation is deployed.
4. No automatic closing based on inactivity and no weekly-window fiction over a longer Stream.
5. No latent Plan materialization, Item-part promotion, collaborators, notifications, or presence.
6. No ownership or lifecycle mutation of the Plans shown by a Stream.
7. No claim that a Stream is repository-authored semantic source. It is live Atlas product state.

## Proposed Form

```text
AtlasUser
  `-- AtlasExecutionStream
        id
        mode: implicit | explicit          # MVP writes implicit only
        status: open | closed
        title
        roots -> AtlasExecutionStreamRoot[] -> AtlasPlan
        currentFocusPlanId?
        openedAt / closedAt? / updatedAt
        `-- AtlasExecutionStreamActivity[]
              kind: pull-request-merged
              pullRequestId                 # one Stream assignment per PR
              planId?                       # primary resolved Plan
              occurredAt
```

Lifecycle:

```text
no open implicit Stream
  + attributable merged PR with Plan evidence
  -> create Stream, infer root, set focus, append activity

open implicit Stream
  + attributable merged PR with Plan evidence
  -> retain Stream root, move focus, append activity

open implicit Stream
  + User closes it
  -> status=closed; Plans remain unchanged
```

Attribution uses `(providerId = github, accountId = GitHub user.id)` to resolve an Auth Account and
therefore its Atlas User. GitHub login, display name, and email are not attribution keys.

When one PR references several targets, the first resolved `Atlas-Implements` Plan is the primary
focus; a resolved Plan from another directive is the fallback. All evidence remains available in
the shared graph even though the Stream records one primary navigation node.

An inferred root is the highest currently known `parentPlanId` ancestor of a primary Plan. A Stream
may accumulate several roots when the User works on disjoint Plan families without closing it; the
Sessions view is therefore a small forest even though the personal interval remains one Stream.
The Stream persists its initial title and references so it remains intelligible if source
projection changes.

## Execution Slices

1. [x] Replace the broad duplicate-number proposal with this bounded Plan 124 and register the
       Atlas-native Entity and experience contract.
2. [x] Add the expand-first PostgreSQL migration, Ontahí Entity mappings, relations, and queries.
3. [x] Carry stable GitHub actor identity through API fetch and webhook ingress.
4. [x] Append or create the implicit Stream transactionally after a non-duplicate merged-PR
       reconciliation.
5. [x] Add the ownership-checked close operation over the shared Ontahí Operation bridge.
6. [x] Add the Sessions view and bounded current/recent projection.
7. [x] Verify unit, mapping, UI, webhook, migration, and PostgreSQL integration behavior.
8. [x] Dogfood the first real post-deploy merge and record the initial Sessions feedback.
9. [x] Refine Sessions into a fixed workspace with independent scroll, rail-owned Stream context,
       done filtering, and branch collapse/expand.
10. [ ] Dogfood the revised workspace with a longer tree and PR history.

## Verification

- [x] The migration applies to an empty database, repeats safely, and remains compatible with the
      prior deployed application.
- [x] Ontahí exposes User-to-Streams, Stream-to-root/focus/activity, and Activity-to-PR/Plan
      relations over the intended physical tables.
- [x] A merged PR from a linked GitHub account with resolved Plan evidence creates one implicit
      Stream when none is open.
- [x] Another attributable merge appends to the same Stream and updates focus without changing its
      root.
- [x] A replayed GitHub delivery does not duplicate Stream activity.
- [x] An unknown GitHub actor or PR without resolved Plan evidence creates no Stream.
- [x] Only the owning authenticated User can close a Stream.
- [x] Closing preserves unfinished Plans and the next attributable merge creates a new Stream.
- [x] Sessions distinguishes current focus, done/current/next branches, activity, recent history,
      and the no-open-stream state on desktop and mobile.
- [x] Sessions keeps its shell fixed while Plan and merged-PR panels scroll independently, exposes
      current state/close from the session rail, and supports done filtering plus branch collapse.
- [x] Page reads do not fetch or rescan repository history for Stream reconstruction.
- [x] `pnpm verify`, the opt-in PostgreSQL suite, and `git diff --check` pass.

## Decisions

1. One implicit open Stream per User is the default; parallelism becomes explicit if implemented.
2. Closing is the only temporal-boundary signal in the MVP.
3. Stream and Stream Activity are Atlas-native operational Entities, not Markdown source records.
4. Plans remain shared semantic source; Streams reference them but do not own their status.
5. Only stable provider account ID attributes GitHub activity to a User.
6. Only merged PRs with resolved Plan evidence affect Streams in the first slice.
7. Activity is captured incrementally at webhook processing time; page refresh is a bounded DB
   query, not a repository-history reconstruction.
8. No initial backfill keeps the experiment honest and makes deletion straightforward if the model
   proves unhelpful.
9. User-facing Stream mutations travel through bridged Ontahí operations and the shared operation
   dispatcher; product-specific Next.js mutation routes are not part of this model.
10. Sessions is an execution workspace, not a document page: session context belongs in the rail,
    while the tree and activity retain their own viewport and exploration state.

## Open Questions

1. Does highest known Plan ancestor produce a useful Stream title/root, or should creation stop at
   the first cross-project boundary?
2. Should a close action optionally name the completed interval or capture a short closure note?
3. When explicit parallel Streams arrive, is PR annotation sufficient or should Atlas also support
   a temporary focused Stream?
4. Should an explicitly closed Stream ever be reopened, or should resumption always create a new
   temporal Stream linked to the previous one?
5. How much recent history belongs in Sessions before a separate searchable archive is warranted?

## Closure / Evolution

### 2026-09-03 — implementation start

The Wizard-of-Oz pass converged on one implicit Stream per User as the smallest testable model.
Implementation begins on an isolated PR after persistent identity landed. The broader saved
workstream, latent-target, item-part, and collaboration ideas are deliberately not accepted or
discarded yet; real use of this narrower model will determine whether they remain necessary.

### 2026-09-03 — MVP implementation checkpoint

The implementation now captures stable GitHub actor identity during signed merged-PR ingestion,
resolves it through the User's linked Auth Account, and appends activity to one durable implicit
Stream inside the projection-reconciliation transaction. The Ontahí model exposes the Stream,
root membership, activity, User, Plan, and Pull Request relationships; the authenticated bridged
close operation preserves Plan state and lets the next attributable merge create a new interval.

Sessions now renders the current Plan forest, focus, adjacent branches, recent PR activity, closed
history, and the waiting state. Reads are bounded PostgreSQL projections and do not replay GitHub
history. `pnpm verify` passed with 74 unit/UI tests and the production build/source-trace check;
the opt-in PostgreSQL suite passed all 6 migration and lifecycle tests. The Plan remains current
only for post-deploy dogfooding: the first real merge must confirm whether the inferred root and
focus feel useful in practice.

### 2026-09-03 — bridge correction

Review caught that the first implementation placed a Plan-correct Ontahí close operation behind a
product-specific Next.js route. That boundary duplicated invocation and identity plumbing already
owned by Atlas's operation bridge. The PR is corrected so the UI invokes the typed client operation
through the generic `/operations` adapter, which shares Atlas's filtered operation dispatcher with
`/runtime`; the operation derives ownership from the runtime Principal. The ad hoc close route and
client-supplied User identity are removed. The dispatcher now rejects every operation not explicitly
marked `exposure: 'bridge'`, closing the pre-existing possibility of addressing a server-only
operation by name through either generic transport. The operation requirement itself admits only an
Atlas user Principal, so permission checks and execution enforce the same identity boundary.

### 2026-09-03 — first-use Sessions feedback

The first real use showed that the Stream model is useful enough to continue, but the initial page
layout spends too much vertical space on repeated headers and scrolls the whole experience. The next
iteration keeps the Sessions shell fixed, consolidates Stream identity and the close boundary in the
left rail, and gives the Plan tree and merged-PR history independent scroll regions. Tree exploration
also needs a done-status filter and explicit per-branch collapse/expand controls so completed or
irrelevant branches do not dominate the working view.

### 2026-09-03 — fixed-workspace refinement

Sessions now uses one viewport-bound three-zone shell: the left rail owns the current Stream title,
green open state, close affordance, and recent intervals; Plan tree and merged-PR activity are sibling
panels with independent vertical scrolling. The redundant current-stream heading and explanatory
subtitle are removed. Tree controls can hide done Plans, collapse or expand individual branches, and
collapse or expand the visible tree as a whole; these are local presentation choices and do not mutate
Stream or Plan state. The responsive layout keeps the same bounded behavior as stacked tree/activity
panels. `pnpm verify` passed with 75 unit/UI tests, typecheck, production build, and 77 Atlas source
traces. Desktop and mobile browser smoke checks found no document-level overflow or console errors.
