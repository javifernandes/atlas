# 127. Inline Session Fork Selection

Status: done

Definition level: shaped

Parent plan: [Explicit Session Forking And Activity Routing](../done/125-explicit-session-forking-and-routing.md)

## Summary

Let a User select multiple Plans directly in the Session tree they are already inspecting, then
continue that exact selection through a **Fork new Session** action. Keep the fork dialog as the
final naming and review boundary, while adding a focused Plan filter for large trees.

This plan implements and shapes the **Workstream Execution Tree** experience.

## Context

The first explicit-fork slice requires choosing Plans inside a modal that repeats the entire
expanded tree. Dogfooding a real Session showed that this breaks spatial context and makes a known
Plan hard to find, especially because the modal has no search or filtering.

The Session tree already contains the User's active collapse, done-state, and visual context. Fork
selection should begin there rather than forcing the User to rediscover the same branches in a
second surface.

## Scope

- add a local selection mode to the visible Plan tree for open Sessions;
- expose accessible checkboxes and selected-row styling without changing Plan navigation;
- show an exact selected count and enable **Fork new Session** only for a non-empty selection;
- preserve selected Plan IDs when opening and closing the fork review dialog;
- clear selection when the User cancels selection mode, switches Session, or completes a fork;
- add a case-insensitive dialog filter over Plan title, source label, and status;
- retain the existing authenticated fork Operation and exact-root backend contract unchanged;
- cover inline selection, modal filtering, and the unchanged fork request shape in UI tests.

## Non-Goals

- changing Session ownership, persistence, or PR routing;
- moving Plans out of the source Session;
- changing the selected-root validation performed by the server Operation;
- making Plan selection durable across reloads or different Sessions;
- adding global Atlas search semantics to the local fork filter.

## Proposed Form

```text
open Session + Plan tree
  -> Select plans
  -> check one or more visible rows
  -> Fork new Session (N)
  -> name/review dialog seeded with the same selection
  -> existing AtlasExecutionStream.fork operation
```

Selection is local presentation state scoped to the current Session. Collapsing or filtering the
tree does not silently discard selected IDs; the count remains authoritative. The dialog filter
changes only which candidates are visible and never changes the selection by itself.

## Execution Slices

1. [x] Register the inline-selection and filtered-review shape in the Plan and durable experience.
2. [x] Add selection mode, accessible tree controls, selected count, and exact reset boundaries.
3. [x] Preserve selection in the fork dialog and add local candidate filtering.
4. [x] Extend UI tests and run complete application verification.
5. [x] Record closure evidence and move the Plan to `done/`.

## Verification

- [x] a User can select multiple Plans from the currently rendered Session tree;
- [x] the fork CTA is disabled until selection is non-empty and reports the exact count;
- [x] opening the dialog preserves the inline selection;
- [x] filtering the dialog narrows visible Plans without losing checked IDs;
- [x] switching Session and cancelling selection mode clear stale selection;
- [x] the fork Operation receives the exact selected IDs and entered title;
- [x] `pnpm verify` and `git diff --check` pass;
- [x] browser verification covers selection, filtering, dialog review, and a clean console.

## Decisions

1. Selection begins in the tree because that is where the User has already established context.
2. Selection mode is explicit so normal Plan navigation remains the default interaction.
3. The dialog remains the commit boundary for naming and reviewing a fork.
4. Dialog filtering is local and non-destructive; it does not become another Atlas search model.

## Open Questions

1. Should a later slice add **Select visible** for very large filtered result sets?
2. Should inline selection eventually support keyboard range selection after real usage evidence?

## Closure / Evolution

Completed on 2026-09-04 from direct dogfood feedback in Atlas Session
`0d8c5646-6d1b-4fac-af0a-c953fc3121c2`.

The Session tree now owns a bounded selection mode with accessible checkboxes, selected-row styling,
an exact-count fork CTA, and explicit reset boundaries. The existing fork dialog remains the naming
and review boundary, now seeded from the tree selection and equipped with a non-destructive local
filter over title, source, and status.

Evidence:

- focused viewer verification passes all 12 `execution-stream-view` tests;
- `pnpm typecheck`, `pnpm verify`, and `git diff --check` pass;
- local browser verification covered zero-, one-, and multi-selection states, filtered review,
  dialog cancellation with preserved selection, responsive toolbar density, and a clean console.
