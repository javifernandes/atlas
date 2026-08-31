---
id: spec-workstream-atlas.atlas-experiences.history-and-evolution
kind: experience
title: History And Evolution
parent: spec-workstream-atlas.atlas-experiences
status: shaping
horizon: now
supports:
  - spec-workstream-atlas
  - spec-workstream-atlas.atlas-model.current-system-form
  - spec-workstream-atlas.atlas-model.work-item
  - spec-workstream-atlas.atlas-model.relation-model
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
---

History And Evolution is the experience of seeing how an atlas item is changing over time without confusing local development with broader context.

## Local Evolution

Local evolution answers the inward question: what work is developing this item?

It should show child items, plans and work items that directly shape the selected item, targeted tensions, future questions, decisions, and evidence. If there is no direct work yet, the view should stay mostly empty. That emptiness is useful: it reveals a shape that has been named but not yet explored.

## Context

Context answers the outward question: where does this item fit?

It should show parents, dependencies, supports, supported-by links, related items, lateral concepts, and nearby branches. This is valuable for orientation, but it should not pollute the local evolution board.

## Feedback As Input

Feedback is temporal. It is not the stable ontology by itself.

Using an experience can produce feedback, and feedback can become a tension, question, idea, plan, work item, or model update. The atlas should preserve that path without forcing every raw comment into the system model too early.

## Child Items

1. [`Local Evolution Projection`](./history-and-evolution/local-evolution-projection.md)
2. [`Context Projection`](./history-and-evolution/context-projection.md)
