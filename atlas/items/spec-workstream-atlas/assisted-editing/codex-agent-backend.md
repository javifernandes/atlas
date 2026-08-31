---
id: spec-workstream-atlas.assisted-editing.codex-agent-backend
kind: capability
title: Codex Agent Backend
parent: spec-workstream-atlas.assisted-editing
status: idea
horizon: later
supports:
  - spec-workstream-atlas.assisted-editing
relatedPlans:
  - plans/backlog/103-workstream-atlas-assisted-editing.md
---

Codex Agent Backend escalates larger atlas edits to an agent that can work against the repo: edit markdown, run validation, create a branch, and prepare a PR.

This should be separate from the LLM provider path because it has tool authority, filesystem effects, and review workflow responsibilities.
