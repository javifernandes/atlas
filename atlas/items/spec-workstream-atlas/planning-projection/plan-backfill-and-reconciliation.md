---
id: spec-workstream-atlas.planning-projection.plan-backfill-and-reconciliation
kind: capability
title: Plan Backfill And Reconciliation
parent: spec-workstream-atlas.planning-projection
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.planning-projection
  - spec-workstream-atlas.atlas-model.plan
  - spec-workstream-atlas.atlas-model.plan.outline-v0
  - spec-workstream-atlas.atlas-experiences.plan-closure
relatedPlans:
  - plans/next/110-plan-backfill-and-reconciliation.md
  - plans/next/107-plan-model-research-and-v0.md
  - plans/next/106-atlas-plan-reconciliation-operation.md
---

Plan Backfill And Reconciliation turns the [[spec-workstream-atlas.atlas-model.plan.outline-v0|Plan Outline v0]] into a practical cleanup and understanding workflow.

The point is not to make every old plan pretty. The point is to make high-value plans easier for humans and agents to read: what the plan intended, what landed, what changed, what remains, and which durable atlas items were shaped.

This capability starts manually and markdown-first. It should not create a work item for every plan. Later, [[spec-workstream-atlas.assisted-editing.plan-status-review|Plan Status Review]] and `ReviewPlanState` can automate parts of the same workflow.

## Shape

1. Select high-signal plans when they become relevant to current work.
2. Reshape only when it improves future work or prevents repeated interpretation cost.
3. Preserve historical intent while clearly naming closure, drift, follow-ups, and superseded paths.
4. Link reshaped plans back to durable Atlas items.
5. Avoid cataloging work unless the catalog itself becomes useful in Atlas.
