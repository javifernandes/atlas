---
id: spec-workstream-atlas.atlas-experiences.atlas-shaping
kind: experience
title: Atlas Shaping
parent: spec-workstream-atlas.atlas-experiences
status: idea
horizon: next
supports:
  - spec-workstream-atlas
  - spec-workstream-atlas.semantic-source
  - spec-workstream-atlas.assisted-editing
  - spec-workstream-atlas.atlas-experiences.history-and-evolution
  - spec-workstream-atlas.operating-practice.archaeological-reading
relatedPlans:
  - plans/next/105-atlas-shaping.md
  - plans/backlog/103-workstream-atlas-assisted-editing.md
  - plans/done/104-atlas-source-shape-v0.md
---

Atlas Shaping is the experience of giving form to the living atlas model: first ideas, model concepts, projects, practices, prototypes, implementation evidence, and later reinterpretation.

It watches or receives changes, reconstructs what they imply for atlas items, relationships, experiences, capabilities, evidence, and future work, then presents a reviewable proposal instead of silently rewriting the source.

Re-shaping is one mode of Atlas Shaping: revisiting an atlas item after code, plans, prototypes, or project boundaries changed.

The first useful slice should focus on reconstructing the evolution of one selected atlas item from plans and atlas source. Later slices can run automatically from GitHub pushes and PR merges.

The same relationship data should support item-scoped planning boards: when a user enters one atlas item, Atlas can show past materialized work, current branches, next/backlog branches, and future signals for that local sphere instead of forcing every project into one global board.
