# 122. Plan-Centered Execution Projection

Status: done

## Summary

Separate Atlas's execution and structure lenses more clearly: the Board projects Plans through
Now, Next, Later, and optional history, while the Map remains the place for durable ontology and
shows Plans as visually distinct temporal interventions.

## Context

The global Board previously placed concepts, capabilities, entities, artifacts, and Plans in the
same time columns. Durable items can carry a horizon or shaping status, but that does not mean work
has started or that the item itself is the executable unit. Treating those items like cards of work
blurred possible system form with the intervention chosen to advance it.

Plans provide the bounded execution record: they describe what is being attempted, why, how it will
be verified, and whether it is current, next, later, or done. Durable items provide the structure
those Plans shape.

## Scope

1. Restrict the global Board to Plan nodes.
2. Preserve project filtering by deriving project-relevant Plans from structural and shaping links.
3. Preserve `Show history`, now as completed Plan history rather than materialized item history.
4. When global search selects a non-Plan from Board, return to Map and focus that item.
5. Give Plan nodes a distinct temporal treatment in Map.

## Non-Goals

1. Do not hide Plans from Map by default or add a Map visibility toggle in this slice.
2. Do not remove horizon or status from durable Atlas Items.
3. Do not require every future idea to have a Plan before it can exist in the ontology.
4. Do not redesign local item Evolution boards, which intentionally combine local shapes and work.

## Proposed Form

- Map answers: what is the system and how is it shaped?
- Board answers: what interventions are happening now, promoted next, deferred, or completed?
- A future Map control may hide or reveal the temporal Plan layer without changing the underlying
  relationships.

## Execution Slices

- [x] Make global Board columns Plan-only without breaking project or history filters.
- [x] Route non-Plan Board search results back to Map.
- [x] Differentiate Plan nodes visually in Map.
- [x] Update tests and the smallest durable experience items.

## Verification

- [x] `pnpm verify`
- [x] `git diff --check`
- [x] Inspect all-project and Ontahi Board states plus Plan styling in Map.
- [x] Preserve the Plan-only [Board capture](../../docs/evidence/120-board-project-filter/board-ontahi.jpg)
  and the [distinct Plan layer in Map](../../docs/evidence/122-plan-centered-execution-projection/map-plan-layer.jpg).

## Closure / Evolution

The global Board now contains only Plans. Project scoping and completed history continue to operate
over that Plan set, and column descriptions use Plan-specific language. Global search keeps Plans
inside Board but returns concepts, capabilities, entities, and other durable items to Map.

In Map, Plan nodes use a dashed border to distinguish temporal interventions from the durable
ontology they shape. Making that temporal layer hideable remains a focused follow-up rather than an
implicit expansion of this slice.
