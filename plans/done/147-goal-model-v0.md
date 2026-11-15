# 147. Goal Model v0

Status: done
Advances: spec-workstream-atlas.goal.legible-system-evolution

## Summary

Make Goal a small, usable Atlas Work Item: a typed durable declaration of a desired outcome that
Plans can explicitly advance without turning releases, milestones, or plan folders into strategy.

## Context

Atlas already distinguishes Goals from Plans semantically, but `Goal` is still authored as a
generic concept. The source parser, graph, and viewer do not understand `kind: goal` or `Plan
advances Goal`, so the distinction cannot yet organize real work.

The immediate pressure comes from release modeling. Package versions can prove when work became
available, but they should not become the mandatory containers for product planning. A Goal gives
emerging Plans a shared desired outcome while releases remain observed delivery evidence.

## Research / Evidence

1. `atlas/items/spec-workstream-atlas/atlas-model/goal.md` already defines Goal as a strategic Work
   Item and Plan as a bounded intervention.
2. `plans/current/102-workstream-atlas-implementation-evidence.md` already connects Plans to
   package versions and releases, but it has no higher-level outcome to advance.
3. The semantic snapshot already supports typed Items and explicit graph relations, so this slice
   can extend the existing source contract without introducing persistence or a new subsystem.

## Scope

1. Add `goal` to the supported Atlas Item kinds.
2. Parse an `Advances:` metadata line on Plans as one or more stable Goal ids.
3. Project `Plan -> Goal` as a navigable `advances` relation.
4. Render Goal identity distinctly through the existing generic detail and relation surfaces.
5. Add one Atlas-owned Goal and connect real Plans to it.

## Non-Goals

1. Do not calculate percentages, health, completion, or confidence for a Goal.
2. Do not introduce initiatives, milestones, roadmaps, or release commitments.
3. Do not force Goals into a strict decomposition tree.
4. Do not add Goal-specific authoring operations or persistence in this slice.
5. Do not copy the Ontahí `independently-usable` Goal into Atlas.

## Proposed Form

```yaml
---
id: spec-workstream-atlas.goal.legible-system-evolution
kind: goal
title: System Evolution Is Legible
parent: spec-workstream-atlas
status: active
---
```

```md
# A Plan

Status: current
Advances: spec-workstream-atlas.goal.legible-system-evolution
```

`Advances:` accepts a comma-separated set of stable Item ids. Valid targets are Goals. Missing or
non-Goal targets remain absent from the graph rather than being inferred from prose.

## Execution Slices

1. [x] Extend the snapshot kind and relation contracts with `goal` and `advances`.
2. [x] Parse and validate Plan `Advances:` targets.
3. [x] Add snapshot and viewer coverage for bidirectional navigation.
4. [x] Document Goal's source form and add one concrete `kind: goal` Atlas Goal.
5. [x] Bind Plans 102 and 147 to the concrete Goal and reconcile this checkpoint.

## Verification

1. A `kind: goal` declaration remains a Goal in the semantic snapshot.
2. A Plan with `Advances: <goal-id>` produces exactly one `advances` edge.
3. Missing and non-Goal targets do not produce dangling or misleading edges.
4. The relation is labeled correctly in both directions in the viewer.
5. `pnpm verify` passes.

## Decisions

1. Goal is a first-class Atlas Item kind and a Work Item sibling of Plan.
2. The first source syntax lives on the Plan because advancing a Goal is intent asserted by the
   intervention author.
3. Goal status remains authored qualitative state; progress is not a scalar in v0.
4. Releases may later provide evidence of progress but do not own Goal membership.

## Open Questions

1. Should a Plan eventually distinguish one primary Goal from secondary Goals?
2. When real usage demands decomposition, is `supports`, `refines`, or another relation clearest?

## Closure / Evolution

Closed on 2026-11-15. Goal is now a first-class semantic kind, Plans can declare one or more stable
Goal ids with `Advances:`, and the snapshot projects only valid Goal targets as bidirectional graph
relations. `System Evolution Is Legible` is the first concrete Atlas Goal; Plans 102 and 147 advance
it. Progress calculation, Goal hierarchy, authoring operations, and release-derived evidence remain
deliberately deferred.
