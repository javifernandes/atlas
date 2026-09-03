---
id: spec-workstream-atlas.planning-projection
kind: experience
title: Planning Projection
parent: spec-workstream-atlas.atlas-experiences
status: shaping
horizon: now
supports:
  - spec-workstream-atlas
  - spec-workstream-atlas.atlas-experiences
relatedPlans:
  - plans/done/101-workstream-atlas-semantic-source.md
  - plans/done/107-plan-model-research-and-v0.md
  - plans/done/120-board-project-filter.md
  - plans/done/122-plan-centered-execution-projection.md
---

Planning Projection is the operational view over the same source: map, now/next/later board,
GitHub Project compatibility, and eventually atlas-native planning.

This should not force the semantic tree to behave like a kanban board.

The projection may group Plans by Goal, territory, or model area. Personal execution memory is now
tested separately as an Atlas-native Execution Stream: stable User-scoped state over shared Plan
lineage, rather than a declared Markdown item or a grouping inferred again on every read.

The global Board is a Plan-centered execution projection. Now, Next, and Later contain bounded
interventions rather than concepts, capabilities, entities, or other durable system shapes.
Completed Plans remain behind an explicit `Show history` control. Durable items may still carry
status and horizon metadata, but that metadata does not turn them into executable Board cards.

The Board can also scope that projection to one declared project. Project scope follows containment
and shaping hierarchy from the project Atlas Item, then projects only Plans from that scope. Lateral
relations do not pull unrelated projects into the focused view. The all-project portfolio remains
the default.

## Child Items

1. [`Plan Metadata`](./planning-projection/plan-metadata.md)
2. [`Plan Backfill And Reconciliation`](./planning-projection/plan-backfill-and-reconciliation.md)
