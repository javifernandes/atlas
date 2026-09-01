---
id: spec-workstream-atlas.planning-projection.plan-metadata
kind: capability
title: Plan Metadata
parent: spec-workstream-atlas.planning-projection
status: idea
horizon: later
supports:
  - spec-workstream-atlas.planning-projection
  - spec-workstream-atlas.atlas-model.plan
relatedPlans:
  - bookops://plans/99-semantic-editorial-workflows
  - plans/done/101-workstream-atlas-semantic-source.md
  - plans/done/107-plan-model-research-and-v0.md
---

Plan Metadata is the planning projection layer for describing [[spec-workstream-atlas.atlas-model.plan|Plan]] without forcing operational planning fields into the semantic product tree.

Likely fields include plan kind, scale, scheduling horizon, parent and child links, GitHub Project mapping, ownership, implementation evidence, closure status, and queryable planning attributes.

These fields should become useful only when the atlas needs an operational planning view, not before.
