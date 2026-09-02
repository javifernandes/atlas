---
id: spec-workstream-atlas.map-navigation-ux
kind: experience
title: Map Navigation UX
parent: spec-workstream-atlas.atlas-experiences
status: shaping
horizon: now
supports:
  - spec-workstream-atlas
  - spec-workstream-atlas.atlas-experiences
relatedPlans:
  - plans/done/101-workstream-atlas-semantic-source.md
---

Map Navigation UX covers the full-canvas atlas: pan, zoom, search, selected-node detail, dimming, semantic grouping, and the shift from a flattened plan graph to a navigable product map.

The default canvas keeps navigation chrome minimal: a compact Atlas wordmark reserves the future
logo position, while `Command-K` or `Control-K` opens a wide, opaque search palette. Search results
make plan numbers visually scannable, separate the source name from its canonical URI path, and
retain the full URI as secondary detail. A collapsed branch reports `direct children / total
descendants` so its hidden depth is visible before expansion.

## Child Items

1. [`Shareable Node Routes`](./map-navigation-ux/shareable-node-routes.md)
