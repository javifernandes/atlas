---
id: spec-workstream-atlas.atlas-model.work-item
kind: concept
title: Work Item
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
  - plans/done/101-workstream-atlas-semantic-source.md
---

A Work Item is a planning or temporal item: a goal, plan, task, PR, decision, research note, follow-up, or closure record.

Work Item is not the generic atlas node. The generic product noun is Atlas Item; Work Item is the subset of atlas items that represent work over time.

Work items shape the system model, but they should not be treated as the system model itself. Goals describe desired outcomes; plans describe bounded interventions that advance goals and shape durable model items.

## Child Items

1. [`Goal`](./goal.md)
2. [`Plan`](./plan.md)
3. [`Work Item Impact Surface`](./work-item/impact-surface.md)
