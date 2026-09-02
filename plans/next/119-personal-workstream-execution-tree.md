# 119. Personal Workstream Execution Tree

Status: next

## Summary

Give a person a navigable view of their own unfolding work: the root Plans they chose, the child
Plans each intervention spawned, the branch currently in focus, completed paths, and the sibling or
ancestor branches they can resume. The view is a tree-shaped execution projection over the shared
Atlas graph, not another copy of the Plans and not a replacement for the system Map.

Make explicitly referenced but not-yet-materialized ideas visible at branch tips. Like a wiki red
link, an empty node says “there is an intended thing here” and can later become a Plan or Atlas Item
without losing the reference that anticipated it.

This plan shapes
[[spec-workstream-atlas.planning-projection.workstream-execution-tree|Workstream Execution Tree]].

## Context

Plan execution is recursive rather than linear. Work on a parent exposes a child; work descends
into that child, extracts a sibling, follows another descendant, and later backtracks to an uncle or
an unfinished branch. Now/Next/Later columns show scheduling state, but they do not answer:

1. Where did the current work come from?
2. What did it spawn?
3. Which path has already been traversed or completed?
4. What nearby branch should be resumed?
5. Which work belongs to this person's active thread rather than another participant's workstream?

Reconstructing that path from chat history or asking an agent repeatedly is a failure of the Atlas
projection. The same information should be visible and navigable.

The need for “my workstream” also provides new evidence against treating every workstream as an
anonymous grouping derived from folder or status. A workstream now has potentially stable identity,
selected roots, participants, focus, and presentation state. That does not imply that it owns the
Plans, changes their canonical status, or grants access to them.

## Research / Evidence

Atlas already contains partial foundations:

1. Plan Markdown can declare `Parent plan:` and the semantic application materializes
   `AtlasPlan.parent` / `AtlasPlan.children`.
2. The legacy snapshot recognizes candidate child Plans as `unmaterialized` nodes, but only through
   the ad hoc `Plan Hierarchy Experiment` section.
3. Plan metadata already anticipates parent/child links, ownership, scheduling horizon, and
   queryable planning attributes.
4. The global Board is becoming a Plan-centered execution projection, while Map remains the shared
   structural and ontological view.
5. Workstream is currently mostly a label or inferred grouping. It cannot yet preserve one
   participant's roots, current focus, collapsed branches, or traversal history.

These foundations prove the Plan lineage but not the personal workstream experience or the general
unmaterialized-reference contract.

## Scope

1. Define a Workstream as a named execution lens over shared Plan identities.
2. Represent one primary Plan lineage relation suitable for a tree while keeping dependencies,
   shaping, support, and related links as lateral graph relations.
3. Project roots, ancestors, descendants, siblings, current focus, and completion state.
4. Let a person move focus down a child branch or back to a parent, sibling, or uncle without
   rewriting Plan status.
5. Preserve enough workstream view state to resume the same path later.
6. Define an explicit unresolved-reference form for an intended Plan or Atlas Item.
7. Let an unresolved target be materialized while preserving its incoming relation, source anchor,
   and provenance.
8. Distinguish an addressable part inside an existing Item from an intended standalone node.

## Non-Goals

1. No generic project-management suite, resource allocation, time tracking, or sprint model.
2. No assumption that one Plan belongs to only one person or only one Workstream.
3. No authorization derived from Workstream membership or ownership.
4. No conversion of every heading, capitalized phrase, or TODO into an Atlas node.
5. No requirement that lateral dependencies form a tree or that a Plan have only one broader
   relationship.
6. No automatic mutation of canonical Plan status when a user merely changes navigation focus.
7. No complete collaborative presence, notification, or conflict-resolution design in the first
   slice.

## Proposed Form

### Shared Plan lineage

One explicit primary relation—provisionally `parentPlan` / `spawnedFrom`—answers why a child Plan
exists. A materialized Plan has at most one primary parent for lineage projection. It may retain any
number of dependency, related, shaping, and support relations outside that tree.

The UI can therefore draw one stable execution tree without pretending that the complete Atlas is
a tree.

### Actor-scoped Workstream

A Workstream is a saved projection, provisionally containing:

```text
Workstream
  identity
  title
  selected roots -> Plan[]
  participants
  current focus -> Plan | unresolved target | none
  presentation state
```

The first implementation may persist this locally or as curated Atlas source, but the contract
must not bake browser storage into the model. Personal and team workstreams should be possible
projections over the same Plans. A Plan's lifecycle remains canonical and shared; focus is scoped
to the Workstream.

### Visual execution state

The tree should make the working path scannable:

1. roots establish the selected workstream boundary;
2. parent/child edges show extraction lineage;
3. the focused node is unmistakable;
4. completed Plans paint a completed circle/path;
5. current, next, and deferred branches remain distinguishable;
6. ancestors of focus show the route into the current work;
7. unfinished sibling and uncle branches remain available for backtracking;
8. lateral graph links are available on demand without overwhelming the lineage.

The exact visual language should be tested as an execution-navigation aid, not accepted merely
because it resembles a tree.

### Parts and latent targets

Atlas should distinguish:

1. **Item part:** an addressable section or named fragment inside a materialized Item. It can be
   linked directly but is not automatically an independent lifecycle-bearing node.
2. **Unmaterialized target:** an explicit reference that intends a future Plan or Atlas Item. It has
   a source anchor, label, expected kind when known, relation meaning, and optional intended
   identity, but no fictional fields or lifecycle.

An unresolved target renders as an outlined/empty node. A materialization action chooses its kind
and canonical location, creates the real source, and resolves the existing reference instead of
creating an unrelated replacement.

The authoring syntax remains open. Existing candidate-child declarations and explicit wiki-style
links are evidence; arbitrary capitalization is not an acceptable parser rule.

## Execution Slices

1. **Read-only lineage:** render one selected root Plan and its complete primary parent/child tree,
   with focus path, status, history visibility, and navigation to siblings and ancestors.
2. **Workstream identity:** introduce the smallest explicit Workstream record with selected roots
   and current focus; prove two workstreams can project different paths over shared Plans.
3. **Resume state:** preserve focus and collapsed branches outside canonical Plan status, with an
   explicit persistence boundary.
4. **Latent Plan nodes:** replace the experimental candidate parser with a general explicit
   unresolved Plan reference and render it at the correct branch tip.
5. **Materialization:** create a Plan from a latent target and preserve the original lineage and
   provenance.
6. **Item parts and promotion:** make named Item fragments addressable and prove promotion to a
   standalone Item does not break existing references.
7. **Collaborative proof:** show two participants' workstreams without treating visibility,
   assignment, or presence as authorization.

## Verification

- [ ] A user can open one named Workstream and immediately identify its roots and current focus.
- [ ] The focused Plan's ancestor path, children, siblings, and unfinished uncle branches are
      navigable without searching the global Map.
- [ ] Parent/child lineage is not inferred from generic related/dependency links.
- [ ] Two Workstreams can include the same Plan while retaining independent focus and view state.
- [ ] Changing focus does not mutate canonical Plan status.
- [ ] Completed and unmaterialized branches are visually and semantically distinct.
- [ ] An explicit unresolved target can be materialized without losing its incoming relation or
      source provenance.
- [ ] Addressable Item parts do not become fake standalone Items merely because they are linked.
- [ ] Semantic tests cover lineage, shared membership, focus isolation, unresolved references, and
      materialization continuity.
- [ ] The first UI slice is exercised with the real Ontahí Plans 146, 146a–g, 132, and 145 as a
      branching/backtracking example.

## Decisions

1. The execution tree is a projection over Plan lineage; the complete Atlas remains a graph.
2. Workstream focus is not Plan status, ownership, authorization, or assignment.
3. A single primary parent makes lineage navigable; all other Plan relations remain lateral.
4. Unmaterialized targets require explicit author intent and do not acquire fictional domain data.
5. Materialization resolves an existing semantic promise rather than replacing it with an
   unrelated node.
6. The first proof uses a real multi-repository workstream rather than a synthetic demo.

## Open Questions

1. Is Workstream a first-class Atlas Entity now, or initially a saved projection whose stable
   identity may later justify promotion?
2. Can one Plan declare multiple candidate parents, and if so which relation owns the primary
   lineage?
3. Does current focus belong to one participant, one shared Workstream, or both as separate facts?
4. Which presentation state should be portable across devices versus browser-local?
5. What explicit Markdown syntax best distinguishes an Item part, a latent Item, and a latent Plan?
6. Should materialization preserve a predeclared intended identity or allocate identity only when
   the target kind and source are chosen?
7. How should cross-repository parent Plans and latent targets be authored without copying source?

## Closure / Evolution

Not implemented. The first slice should remain read-only and use Ontahí's Runtime Protocol plan
family as the acceptance example before introducing Workstream persistence or materialization.
