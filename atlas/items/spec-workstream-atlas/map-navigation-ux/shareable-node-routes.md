---
id: spec-workstream-atlas.map-navigation-ux.shareable-node-routes
kind: capability
title: Shareable Node Routes
parent: spec-workstream-atlas.map-navigation-ux
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.map-navigation-ux
relatedPlans:
  - plans/done/101-workstream-atlas-semantic-source.md
  - plans/current/102-workstream-atlas-implementation-evidence.md
---

Shareable Node Routes let someone open the standalone Atlas deployment directly focused on a
specific atlas item or linked plan. The retired BookOps `/internal/plans` compatibility route
redirects to that deployment and preserves query parameters.

Node selection and full detail are URL-addressable. A full-detail URL uses `full=<node-id>` and an
optional `section=overview|evolution|context|source`; an absent or invalid section resolves to
Overview. Section tabs are real links, so they can be copied or opened independently, while normal
clicks update browser history without closing the modal. Back and Forward restore both the focused
node and its section. Parent and child navigator slots use the same full-detail URLs, allowing
modified clicks to open a neighboring structural node directly.

Explicit copy-link controls and URL state for filters or lenses remain later slices.
