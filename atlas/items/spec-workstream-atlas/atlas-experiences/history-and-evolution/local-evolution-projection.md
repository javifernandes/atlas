---
id: spec-workstream-atlas.atlas-experiences.history-and-evolution.local-evolution-projection
kind: capability
title: Local Evolution Projection
parent: spec-workstream-atlas.atlas-experiences.history-and-evolution
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-experiences.history-and-evolution
  - spec-workstream-atlas.atlas-model.work-item
  - spec-workstream-atlas.atlas-model.reconciliation
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
---

Local Evolution Projection is the board-like view of work that develops a selected atlas item.

It is intentionally inward-facing. It should include:

1. direct child items,
2. plans or work items that shape the selected item,
3. targeted tensions,
4. targeted questions and future signals,
5. decisions and evidence that explain how the item changed.

It should not include broad context such as parent items, lateral relations, generic supports links, or everything that depends on the item.

> [!DECISION]
> Target: [[spec-workstream-atlas.atlas-experiences.history-and-evolution|History And Evolution]]
>
> The Evolution tab should be a local work lens, not a generic related-items lens. Empty columns are allowed because they expose unexplored shapes.
