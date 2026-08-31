---
id: spec-workstream-atlas.map-navigation-ux.shareable-node-routes
kind: capability
title: Shareable Node Routes
parent: spec-workstream-atlas.map-navigation-ux
status: idea
horizon: next
supports:
  - spec-workstream-atlas.map-navigation-ux
relatedPlans:
  - plans/done/101-workstream-atlas-semantic-source.md
---

Shareable Node Routes let someone open the standalone Atlas deployment directly focused on a
specific atlas item or linked plan. The retired BookOps `/internal/plans` compatibility route
redirects to that deployment and preserves query parameters.

The first useful slice is probably a stable URL parameter or route segment that selects, focuses, and opens detail for a node by semantic id or plan path. Later slices can add explicit copy-link controls, modal deep links, and URL state for filters or lenses.
