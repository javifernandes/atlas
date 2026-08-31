---
id: spec-workstream-atlas.atlas-model.relation-model
kind: concept
title: Relation Model
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: next
supports:
  - spec-workstream-atlas.atlas-model
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
---

Relation Model defines how atlas items connect: containment, support, shaping, impact, invariant preservation, materialization, replacement, dependency, evidence, typing, instancing, exemplars, references, and unresolved mentions.

The current UI only implements a small subset. The source shape should leave room for richer relations without forcing all of them into the map at once.

`shapes`, `affects`, `preserves`, `breaks`, and `restores` are impact relations that belong first in Work Item detail views. They should not all become default map lines until the UI can prevent relation noise.
