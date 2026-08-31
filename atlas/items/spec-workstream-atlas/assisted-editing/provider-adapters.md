---
id: spec-workstream-atlas.assisted-editing.provider-adapters
kind: capability
title: Provider Adapters
parent: spec-workstream-atlas.assisted-editing
status: idea
horizon: later
supports:
  - spec-workstream-atlas.assisted-editing
relatedPlans:
  - plans/backlog/103-workstream-atlas-assisted-editing.md
---

Provider Adapters let the atlas request structured edit proposals from OpenAI or other LLM services without coupling the UI to a single model vendor.

The provider contract should return proposals, not direct filesystem writes.
