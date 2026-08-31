---
id: spec-workstream-atlas.assisted-editing
kind: experience
title: Assisted Editing
parent: spec-workstream-atlas.atlas-experiences
status: idea
horizon: next
supports:
  - spec-workstream-atlas
  - spec-workstream-atlas.atlas-experiences
relatedPlans:
  - plans/backlog/103-workstream-atlas-assisted-editing.md
  - bookops://plans/99-semantic-editorial-workflows
---

Assisted Editing turns the Workstream Atlas from a semantic viewer into a guided editing surface for markdown-backed atlas items and plans.

The first useful version should not let an LLM silently mutate the repo. It should gather focused context, propose structured changes, preview the graph and markdown diff, and let a human apply or escalate the work.

## Child Items

1. [`Proposal Review UX`](./assisted-editing/proposal-review-ux.md)
2. [`Atlas Context Builder`](./assisted-editing/atlas-context-builder.md)
3. [`Provider Adapters`](./assisted-editing/provider-adapters.md)
4. [`Codex Agent Backend`](./assisted-editing/codex-agent-backend.md)
5. [`Plan Status Review`](./assisted-editing/plan-status-review.md)
6. [`Operation Command Interface`](./assisted-editing/operation-command-interface.md)
