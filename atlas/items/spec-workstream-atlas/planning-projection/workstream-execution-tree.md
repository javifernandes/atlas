---
id: spec-workstream-atlas.planning-projection.workstream-execution-tree
kind: experience
title: Workstream Execution Tree
parent: spec-workstream-atlas.planning-projection
status: shaping
horizon: next
supports:
  - spec-workstream-atlas.planning-projection
  - spec-workstream-atlas.atlas-model.plan
relatedPlans:
  - plans/next/119-personal-workstream-execution-tree.md
---

[[spec-workstream-atlas.planning-projection.workstream-execution-tree|Workstream Execution Tree]]
is an actor-scoped navigation lens over shared
[[spec-workstream-atlas.atlas-model.plan|Plan]] lineage.

It should show where a line of work began, which child Plans each intervention spawned, the path
into the current focus, completed branches, and the sibling or ancestor branches available for
resumption. Parent/child lineage supplies the tree; dependencies, shaping, support, and related
links remain lateral relations in the wider Atlas graph.

A named Workstream may preserve selected roots, participants, current focus, and presentation
state. Those facts do not own the included Plans, change their canonical lifecycle, assign work, or
grant authorization. Two people may project different workstreams over the same shared Plan.

The tree may also show explicitly referenced but unmaterialized targets as empty branch tips. Such
a target records authorial intent and an incoming relation without pretending that a complete Plan
or Atlas Item already exists. Materializing it should resolve that existing reference and preserve
its provenance.

An addressable part within an existing Item is different: it remains a fragment of its containing
Item until an explicit promotion gives it independent identity and lifecycle.
