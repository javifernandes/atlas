# 132. Auth-Aware Sessions And Board Density

Status: done

Definition level: shaped

## Summary

Reduce ambiguity and visual density in Atlas's primary navigation and Board. Sessions remains
discoverable for anonymous viewers but clearly unavailable until GitHub authentication, while each
Board column becomes one continuous list surface whose Plans read as rows rather than independent
cards.

## Context

Sessions projects personal execution memory and therefore has no useful anonymous state. The
current navigation nevertheless lets an anonymous viewer enter it. The Board also repeats a full
border, radius, background, and shadow for every Plan, producing more chrome than hierarchy.

## Scope

1. Pass authenticated-viewer state into the Atlas explorer.
2. Keep Sessions visible but inactive for anonymous viewers, with a subtle hover/focus explanation.
3. Prevent anonymous route state and clicks from opening Sessions.
4. Render each Board column's Plans as rows inside one shared, divided list surface.
5. Preserve selection, hover, summaries, Plan IDs, filtering, history, and full-detail navigation.

## Non-Goals

1. Do not change Session ownership, persistence, or authentication mechanics.
2. Do not redesign Map nodes or detail surfaces.
3. Do not remove Plan summaries from the Board.

## Execution Slices

- [x] Gate Sessions navigation presentation and route activation on authentication.
- [x] Consolidate Board cards into column-owned row lists.
- [x] Add focused viewer and page-boundary regression coverage.
- [x] Run full verification and record closure.

## Verification

- Anonymous viewers see a disabled Sessions control with an authentication explanation.
- Authenticated viewers can enter Sessions normally.
- Board Plans share one bordered list per populated column and use internal separators.
- [x] `pnpm verify` and `git diff --check` pass.

## Closure / Evolution

Closed on 2026-10-25. The server now projects whether the current request has an authenticated
viewer into the client workspace. Anonymous viewers retain a low-emphasis Sessions affordance for
discoverability, but it exposes an authentication hint and cannot activate through clicks or an
initial Sessions URL. Authenticated navigation is unchanged.

Board columns now own one bordered list surface. Plans render as internally divided rows with
item-level hover and an inset selected marker, eliminating repeated card borders, radii, fills, and
shadows while preserving summaries, IDs, filtering, history, and full-detail navigation. The Board
does not wrap the complete column grid or individual column lists in another border, radius, or
shadow. Only vertical column dividers and horizontal row dividers remain; headers and selection use
typography and background tone instead of additional rules.

Map tree nodes preserve lightweight single-click selection and open their full detail directly on
double click, with regression coverage for that navigation gesture.

