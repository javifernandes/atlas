---
id: spec-workstream-atlas.planning-projection.workstream-execution-tree
kind: experience
title: Workstream Execution Tree
parent: spec-workstream-atlas.planning-projection
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.planning-projection
  - spec-workstream-atlas.atlas-model.plan
relatedPlans:
  - plans/current/124-implicit-personal-execution-streams-mvp.md
---

[[spec-workstream-atlas.planning-projection.workstream-execution-tree|Workstream Execution Tree]]
is an actor-scoped navigation lens over shared
[[spec-workstream-atlas.atlas-model.plan|Plan]] lineage.

It should show where a line of work began, which child Plans each intervention spawned, the path
into the current focus, completed branches, and the sibling or ancestor branches available for
resumption. Parent/child lineage supplies the tree; dependencies, shaping, support, and related
links remain lateral relations in the wider Atlas graph.

The first product slice is [[spec-workstream-atlas.atlas-model.execution-stream|Execution Stream]]:
one open implicit Stream per User, bounded by an explicit close action. Attributable merged Pull
Requests append activity and move focus; when none is open, the next attributable merge starts one.
The tree is therefore a projection of live Atlas state over shared Plan lineage, not another Plan
document. Those facts do not own the included Plans, change their canonical lifecycle, assign work,
or grant authorization.

Parallel Streams remain possible but are not safely inferable from repository activity alone. If
introduced, they require explicit routing rather than silent guesses. Sessions initially reads the
current Stream plus bounded recent history instead of reconstructing all work from Git history.

The tree may also show explicitly referenced but unmaterialized targets as empty branch tips. Such
a target records authorial intent and an incoming relation without pretending that a complete Plan
or Atlas Item already exists. Materializing it should resolve that existing reference and preserve
its provenance.

An addressable part within an existing Item is different: it remains a fragment of its containing
Item until an explicit promotion gives it independent identity and lifecycle.
