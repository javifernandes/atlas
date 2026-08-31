---
id: spec-workstream-atlas.assisted-editing.context-builder
kind: capability
title: Atlas Context Builder
parent: spec-workstream-atlas.assisted-editing
status: idea
horizon: next
supports:
  - spec-workstream-atlas.assisted-editing
relatedPlans:
  - plans/backlog/103-workstream-atlas-assisted-editing.md
---

Atlas Context Builder assembles the prompt context for an edit request: selected node, parent, children, siblings, related plans, matching search results, schema rules, and editorial constraints.

The default mode should be stateless and rebuilt from markdown on every request. Longer agent sessions can come later.
