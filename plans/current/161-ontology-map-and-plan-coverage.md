# 161. Ontology Map And Plan Coverage

Status: current

## Summary

Make Atlas Map a legible ontology of durable system form rather than a mixed tree of Items and
temporal Plans. Give full-detail navigation one stable action back to that Map, then use separate
compact Plan projections to show which durable Items a Plan covers.

## Context

Plans currently appear as nodes in the main Map. Their quantity and temporal branching obscure the
durable hierarchy just as Atlas begins to accumulate richer Items, while Plans are already
addressable through Board, search, Item Evolution, Sessions, and direct routes. Full detail also
uses browser-like Back semantics, so a reader who traverses several related Items must unwind that
history repeatedly before returning to the ontology.

The pressure points to two distinct lenses:

1. Map should answer what durable things exist and how they are structurally related.
2. A Plan should answer which part of that durable form it intends to or demonstrably did affect.

## Research / Evidence

1. `Map Navigation UX` already calls Map primarily structural and ontological, but retained Plans
   as visually distinct peers pending stronger product evidence.
2. Board, search, Sessions, related Plans, and Item Evolution now keep Plans discoverable without
   requiring them in the ontology tree.
3. Item Evolution can distinguish direct evidence from evidence inherited `via Plan`, establishing
   the provenance needed for a later Plan coverage outline.

## Scope

1. Add a stable one-action return from full detail to the Map, independent of navigation history.
2. Exclude Plan nodes and Plan-only edges from the Map projection by default.
3. Preserve Plans in Board, search, direct routes, Context, Evolution, and Sessions.
4. Define the first compact Plan coverage outline from declared and observed Item relationships.

## Non-Goals

1. Do not delete Plans or remove them from the shared snapshot.
2. Do not turn coverage into a completion percentage.
3. Do not infer Item impact from PR titles, filenames, or general prose.
4. Do not implement the complete Plan outline visualization in the first Map-simplification slice.

## Proposed Form

Map contains durable Atlas Items and structural relationships only. A dedicated Map action in full
detail closes the focus surface, selects the addressed Item when it belongs to Map, and returns to
the ontology without replaying intermediate navigation history.

A later Plan coverage outline renders affected Items as a compact field of points. Color and
grouping express relationship/provenance such as declared shaping, direct observed evidence, and
indirect materialization. It is coverage of system surface, not calculated progress.

## Execution Slices

### Slice 1 — Ontology-first Map

- [x] Add a stable `Back to Map` action to full detail.
- [x] Remove Plan nodes from the Map projection.
- [x] Keep Plan search, direct detail, Board, Sessions, and Item relationships working.
- [x] Verify structural counts and branch expansion no longer include hidden Plans.

### Slice 2 — Plan coverage outline

- [ ] Define coverage categories and provenance.
- [ ] Prototype compact Item points grouped by territory or kind.
- [ ] Navigate from a point to the affected Item.
- [ ] Test dense, sparse, and evidence-free Plans without presenting false completion.

## Verification

1. Map renders no Plan nodes while Board and search still find them.
2. A directly addressed Plan remains readable in full detail.
3. One action returns from any full-detail navigation depth to Map.
4. Returning to Map selects the current durable Item when it is part of the ontology.
5. Existing map traversal, collapse counts, keyboard navigation, and routes remain valid.
6. `pnpm verify` passes.

## Decisions

1. Map is an ontology lens, not the union of every Atlas node type.
2. Plans remain first-class, but their primary spatial projections are Board, Sessions, Evolution,
   and the future coverage outline.
3. Plan coverage describes affected surface and evidence strength, never automatic completion.

## Open Questions

1. Should coverage points group primarily by territory, Item kind, or both at different zooms?
2. Should a Plan point distinguish declared intent from first observed materialization by fill and
   outline, or by separate rows?

## Closure / Evolution

Open. The first slice establishes the ontology boundary and stable navigation. Coverage rendering
follows after the simplified Map can be evaluated with real Atlas and Ontahi trees.

## Checkpoints

### 2026-11-23 — Ontology-first Map implemented

The Map projection now builds hierarchy, visibility, edges, layout, and branch counts from durable
non-Plan nodes. Plans remain in the shared snapshot and continue to resolve through Board, search,
direct full-detail routes, and relationship lenses. Full detail now exposes a stable ontology Map
action that skips its local Back stack, restores the Map lens, and focuses the current durable Item
when one exists. The focused explorer suite covers all of these boundaries.
