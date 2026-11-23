# 160. Release Stories And Item Evolution

Status: current
Advances: spec-workstream-atlas.goal.legible-system-evolution

Depends on:

- [102. Atlas Implementation And Release Evidence](../current/102-workstream-atlas-implementation-evidence.md)
- [159. Work Classification And Evolution Facets](../current/159-work-classification-and-evolution-facets.md)

## Summary

Turn package versions and releases into navigable chapters of system evolution, and let every
durable Atlas Item explain in which versions its form became available or changed.

The experience combines ubiquitous micro-signals, a contextual explanation, and a dedicated
history lens. It uses Plans, Pull Requests, Changesets, Component Versions, Releases, durable
Items, and work facets without making any one record pretend to own the complete history.

## Context

Ontahí users cannot easily answer what a version contains. Registries show version identity,
Changesets summarize package impact, Pull Requests show implementation, and Plans preserve intent,
but the reader must reconstruct their relationship manually.

The inverse question is equally important: how did an Entity, Interaction, Operation, Surface, or
other durable Item arrive at its current form? A file timeline cannot distinguish semantic
evolution, implementation evolution, and availability across releases.

## Research / Evidence

1. Plan 102 already defines `ComponentVersion` and `Release` as observed entities and requires
   bidirectional Plan/Item/version navigation.
2. [[spec-workstream-atlas.atlas-experiences.history-and-evolution|History And Evolution]] keeps
   local evolution separate from broad system context.
3. [[spec-workstream-atlas.atlas-experiences.history-and-evolution.local-evolution-projection|Local
   Evolution Projection]] already treats decisions and evidence as explanations of change.
4. Plan 159 adds the work facets needed to distinguish refactors, features, migrations, and other
   kinds of change within the same chronology.
5. Ontahí's source-organization refactor provides a real multi-PR, multi-release narrative pilot.

### First reconstructed release story — `@ontahi/core@1.0.0-alpha.21`

`alpha.21` is the first published Component Version known to materialize
`ontahi://plans/171-core-model-and-runtime-boundaries`. Its release boundary groups five Plan 171
Pull Requests with adjacent replicated-model work:

1. PR 326 establishes the model, value, computation, and runtime boundary direction.
2. PRs 327 and 328 extract value-schema, Field, and Entity construction ownership.
3. PRs 329 and 330 separate portable Operation declarations from runtime resolution.
4. Release PR 322 publishes those changes as `@ontahi/core@1.0.0-alpha.21` while preserving the
   established public API through compatibility facades.
5. The same Release includes Plan 169 replicated-model capabilities, so its story cannot inherit a
   single `refactor` classification.

The inverse Item projection is:

```txt
ontahi.source-code-organization
  changed in @ontahi/core@1.0.0-alpha.21
  through ontahi://plans/171-core-model-and-runtime-boundaries
  with work nature: refactor
  compatibility: established exports preserved
  continued in: alpha.22 candidate and unreleased Plan 171 slices
```

This is a reconstructed claim with mixed evidence strength. The release and included commits are
observed; Plan attribution is explicit in the release note for the main boundary extraction but
several contributing PR bodies predate or vary from the supported Atlas directive syntax.

### Candidate continuation — `1.0.0-alpha.22`

The open Ontahí release PR 333 currently groups in-memory runtime, client-cache, Zod-boundary, and
Query/Selection work. Some Plan 171 PRs use empty Changesets because they only enforce or relocate
internal boundaries, so they do not appear in generated package notes even though they belong to
the evolutionary line. The candidate must remain visibly unreleased until publication is observed.

This proves that Release Story assembly needs both inclusion paths:

```txt
Release -> Changesets -> consumer-visible notes
Release -> commits / PRs -> complete implementation history
```

Plan and Item bindings then explain which parts of that combined evidence belong to the same
evolutionary line.

## Scope

1. Render a Release Story that answers what became available, why, and through which evidence.
2. Render an Item history that separates semantic form, implementation realization, and released
   availability.
3. Navigate bidirectionally between versions, Plans, Items, Surfaces, and evidence.
4. Show work nature, impact, and compatibility as secondary narrative facets.
5. Represent partial, continued, superseded, and uncertain evolution explicitly.
6. Provide micro-signals and contextual drill-down in existing Plan and Item surfaces.

## Non-Goals

1. Do not replace changelogs, registries, GitHub, or repository history as authorities.
2. Do not infer Plan completion from a Release.
3. Do not treat every commit as an evolutionary moment.
4. Do not require every historical relationship to be reconstructed with false precision.
5. Do not make the first slice a generic timeline or analytics dashboard.
6. Do not predict future Release contents from current Plans.

## Proposed Form

### Release Story

A Component Version or Release projects evidence as a readable chapter:

```txt
@ontahi/core@<version>
  introduced / changed / fixed
  advanced Plans
  shaped durable Items and Surfaces
  included Changesets and Pull Requests
  contributed to longer lines of work
  left continuations or migration pressure
```

Evidence remains inspectable. The narrative groups it; it does not replace it.

### Item history

An Item's history distinguishes:

1. semantic evolution: changes in meaning, responsibility, invariants, or form;
2. implementation evolution: Components and Surfaces that realize it;
3. availability evolution: Component Versions and Releases in which those changes became usable.

The primary unit is an evolutionary moment: an explainable grouping of intent, change, evidence,
and materialization. A moment may span several PRs or Releases when they belong to one coherent
line, but Atlas must expose how that grouping was derived.

### Progressive experience

1. Micro-signals: `Available since`, `Changed in`, work-nature cue, and `View evolution`.
2. Contextual explanation: a compact panel explaining the relationship without losing place.
3. Dedicated lens: narrative, moments, versions, Plans, and evidence projections over the same
   underlying graph.

### Relationship semantics

Candidate projections include `firstAvailableIn`, `changedIn`, `materializedIn`, `continuedIn`,
and `supersededIn`. Prefer derived projections where deterministic evidence already exists. Add a
stored relation only when it carries authored meaning or cannot be reproduced reliably.

## Execution Slices

### Slice 0: Ontahí release-story prototype

1. [x] Select one intermediate Ontahí release from the source-organization refactor.
2. [x] Resolve its Changesets, Pull Requests, Plans, affected Components/Surfaces, and shaped Items.
3. [x] Produce a static but evidence-linked Release Story.
4. [x] Add the inverse `Changed in` projection to one durable subject.
5. [x] Test the narrative against the release candidate and active work after it.

### Slice 1: Product projection contract

1. Define evolutionary-moment grouping and provenance.
2. Define partial, continued, superseded, and uncertain states.
3. Add work-facet grouping from Plan 159.
4. Decide which relationships are derived versus persisted.

### Slice 2: Progressive navigation

1. Add micro-signals to Plan, Item, Component, and evidence surfaces.
2. Add contextual explanation without leaving the current detail view.
3. Add a dedicated Release Story route or addressed detail state.
4. [x] Add a proportional delivery timeline beneath the semantic evolution map in Item Evolution.
5. Extend Item Evolution with explicit semantic, implementation, and availability lenses.

## Verification

- [ ] A reader can explain what one Ontahí version contains without opening GitHub or npm.
- [ ] Every narrative claim links to authoritative or provenance-bearing evidence.
- [ ] Navigation works from Release to Item and from Item to Release.
- [ ] A multi-release refactor remains legible as one line without collapsing its intermediate
      versions.
- [ ] Internal refactors and public-surface impact remain distinguishable.
- [ ] Partial release evidence does not mark a Plan done.
- [ ] Uncertain historical reconstruction is visible as uncertainty.
- [ ] The experience remains useful when a Release has no shaped Atlas Items.

## Decisions

1. Treat a version as a chapter of system evolution, not only a package identifier.
2. Use both ambient micro-signals and a dedicated history lens.
3. Keep semantic, implementation, and availability evolution distinct but navigable together.
4. Group around explainable evolutionary moments rather than raw commits.
5. Preserve evidence and provenance beneath every generated narrative.
6. Pilot the experience on Ontahí before generalizing it to BookOps.

## Open Questions

1. Is Release Story a route, a full-detail section, or both?
2. Which source provides the canonical release boundary when npm and GitHub releases differ?
3. How much narrative is deterministic grouping versus generated interpretation?
4. How should a fixed Changesets group present several Component Versions in one Release?
5. When should a long refactor appear as a named moment versus a sequence of related moments?

## Closure / Evolution

Opened on 2026-11-23 from the need to understand both what an Ontahí version contains and how a
durable Atlas Item reached its present form. Split from Plan 102 so evidence ingestion and product
narrative can evolve with explicit ownership.

The first manual prototype uses `@ontahi/core@1.0.0-alpha.21` as a published chapter and
`1.0.0-alpha.22` as an explicitly unreleased continuation. It demonstrates that Changesets alone
omit meaningful internal refactor evidence and that a Release may compose several work natures and
Plans. Slice 0 is complete as a static evidence-backed prototype; implementation remains `next`
until Plan 102 exposes the required observed release projection.

### 2026-11-23 — chronological implementation arc

The first product slice replaces the horizontal merged-PR strip with an evidence-backed evolution
story. Item Evolution now summarizes the observed date range and repository count, groups merged
PRs into daily implementation moments, orders changes chronologically, and recognizes release or
version PR titles as delivery checkpoints. The existing Past / Now / Next / Later semantic board
remains separate beneath it.

Dogfooding `ontahi.source-code-organization` renders eleven explicit PR bindings across five
observed moments, including the corrected Plan 171 evidence chain. This proves that Atlas can make
a long refactor legible before Component Version ingestion exists. It does not yet claim that daily
groups are durable semantic moments or that a PR title is authoritative release evidence; those
remain presentation heuristics until Plan 102 provides Release entities and version relations.

### 2026-11-23 — semantic map with observed delivery rail

The vertical implementation arc made Pull Requests look like a second, competing account of Past
beside the Past / Now / Next / Later semantic board. Mixing PRs into Past would instead duplicate
Plans and collapse delivery evidence into semantic evolution.

The revised prototype keeps the board as the semantic map and places a minimal horizontal delivery
timeline beneath it. Merged PRs are grouped by observed day between the first binding and Now;
bubble size encodes the number of PRs in that day. Dogfooding showed that a
strict calendar scale made a months-old first observation compress several active days into an
unusable cluster, so observed days now use equal event spacing while retaining their dates on
hover. The popup shows linked PR titles, Atlas-styled PR numbers, and authors without repeating the
date on every row. The timeline omits explanatory copy, permanent date labels, and
single-repository statistics so the evidence reads as one quiet supporting layer.

PR 130 remains in the item-wide history because its explicit `Atlas-Shapes` directive targets
`ontahi.source-code-organization` and it added the Devtools child to that shape. It does not belong
to the current Plan 171 refactor line, proving that later slices need a visible distinction between
complete Item history and a selected evolutionary line.
