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
brand-mark position, while `Command-K` or `Control-K` opens a wide, opaque search palette. The
compact mark and the full-page loading boundary share one image-only symbol; `Atlas` and its product
language remain HTML text so they can evolve independently from the artwork. The loading boundary
occupies the canvas while server-side source assembly is pending, preserving theme contrast and
making a slow refresh visible instead of presenting an inert background. Search results
make plan numbers visually scannable, separate the source name from its canonical URI path, and
retain the full URI as secondary detail. A collapsed branch reports `direct children / total
descendants` so its hidden depth is visible before expansion.

Full detail is also a vertical hierarchy navigator. The direct structural parent occupies a subtle
centered slot above the node title, while direct children occupy a soft horizontal rail below the
content. Selecting either keeps the modal shell open and replaces its node; child overflow scrolls
horizontally with snap points instead of introducing another hard-divided panel. Related, support,
and shaping edges remain in Context or Evolution rather than pretending to be structural children.
When the rail projects direct children, Overview suppresses the conventional Markdown `Child
Items` section so navigation is not rendered twice.

## Child Items

1. [`Shareable Node Routes`](./map-navigation-ux/shareable-node-routes.md)
