---
id: spec-workstream-atlas.atlas-experiences
kind: territory
title: Atlas Experiences
parent: spec-workstream-atlas
status: shaping
horizon: now
supports:
  - spec-workstream-atlas
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
  - plans/done/101-workstream-atlas-semantic-source.md
  - plans/done/134-full-detail-reading-position.md
---

Atlas Experiences are the human workflows the atlas should support: navigating the map, authoring the model, planning work, closing plans, reviewing evidence, and reading history.

Full detail keeps semantic content and its source provenance on one continuous reading surface.
The Source view exposes the authoritative repository file and observed revision without repeating
hierarchy already expressed by detail navigation.

Atlas uses motion to communicate living structure rather than generic waiting: reading-position
feedback follows the viewport continuously, while loading animates the graph mark itself with
restrained, reduced-motion-safe expansion.

Long-form full-detail reading should preserve native scrolling input while using quiet Atlas-owned
position feedback instead of visually dominant platform scrollbar chrome. The indicator should
communicate both viewport scale and current position without becoming another panel boundary.

## Child Items

1. [`Map Navigation UX`](./map-navigation-ux.md)
2. [`Model Authoring`](./atlas-experiences/model-authoring.md)
3. [`Planning Projection`](./planning-projection.md)
4. [`Plan Closure`](./atlas-experiences/plan-closure.md)
5. [`History And Evolution`](./atlas-experiences/history-and-evolution.md)
6. [`Assisted Editing`](./assisted-editing.md)
7. [`Atlas Shaping`](./atlas-experiences/atlas-shaping.md)
