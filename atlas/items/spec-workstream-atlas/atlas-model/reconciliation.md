---
id: spec-workstream-atlas.atlas-model.reconciliation
kind: operation
title: Reconciliation
parent: spec-workstream-atlas.atlas-model
status: idea
horizon: next
supports:
  - spec-workstream-atlas.atlas-model.current-system-form
  - spec-workstream-atlas.atlas-model.form-transformation
  - spec-workstream-atlas.atlas-model.evidence-binding
  - spec-workstream-atlas.atlas-experiences.history-and-evolution
  - spec-workstream-atlas.assisted-editing.plan-status-review
relatedPlans:
  - plans/next/106-atlas-plan-reconciliation-operation.md
  - plans/done/104-atlas-source-shape-v0.md
---

[[spec-workstream-atlas.atlas-model.reconciliation|Reconciliation]] is the operation family that compares intention, implementation, evidence, and the current atlas model.

It answers the questions that currently happen in chat:

1. what did this work item intend to change?
2. what actually landed?
3. what changed during implementation?
4. what remains open?
5. what was superseded, abandoned, or invalidated?
6. what atlas items, relations, plans, or evidence should be updated?

The first concrete operation is `ReviewPlanState`: given one plan and enough repo context, produce a read-only proposal with landed work, drift, open work, follow-ups, atlas item updates, and human questions.

Later reconciliation operations can run from PR merges, GitHub pushes, manual Atlas UI actions, or user-instructed assisted editing.
