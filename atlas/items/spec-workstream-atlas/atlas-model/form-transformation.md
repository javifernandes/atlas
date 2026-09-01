---
id: spec-workstream-atlas.atlas-model.form-transformation
kind: concept
title: Form Transformation
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model.work-item
  - spec-workstream-atlas.atlas-model.work-item.impact-surface
  - spec-workstream-atlas.atlas-model.evidence-binding
  - spec-workstream-atlas.atlas-experiences.atlas-shaping
relatedPlans:
  - plans/backlog/105-atlas-shaping.md
  - plans/done/107-plan-model-research-and-v0.md
  - plans/next/109-work-item-impact-surface.md
---

[[spec-workstream-atlas.atlas-model.form-transformation|Form Transformation]] is the intended or discovered change to a [[spec-workstream-atlas.atlas-model.current-system-form|Current System Form]].

It can be proposed by a plan, exposed by a bug fix, discovered during implementation, extracted from historical plans, or inferred after a project boundary changes.

A transformation can:

1. shape a new atlas item,
2. reshape an existing item,
3. affect a related item without defining it,
4. preserve, break, restore, or introduce an invariant,
5. promote a repeated phrase into a model concept,
6. retire stale or superseded structure,
7. create follow-up work.

Atlas does not need every transformation to be fully implemented on day one. It needs enough language to show what a work item is trying to change, what actually changed, and what still needs reconciliation.
