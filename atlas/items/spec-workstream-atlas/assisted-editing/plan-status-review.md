---
id: spec-workstream-atlas.assisted-editing.plan-status-review
kind: capability
title: Plan Status Review
parent: spec-workstream-atlas.assisted-editing
status: idea
horizon: next
supports:
  - spec-workstream-atlas.assisted-editing
  - spec-workstream-atlas.atlas-model.plan
  - spec-workstream-atlas.implementation-evidence
relatedPlans:
  - plans/backlog/103-workstream-atlas-assisted-editing.md
  - plans/backlog/102-workstream-atlas-implementation-evidence.md
  - plans/next/106-atlas-plan-reconciliation-operation.md
  - plans/next/107-plan-model-research-and-v0.md
---

Plan Status Review lets a user ask whether a plan's current status still matches the repo.

The first concrete operation is `ReviewPlanState`: given a selected plan, related atlas items, and repo evidence, produce a reviewable proposal instead of silently editing files.

The action needs an agent-style backend because it must inspect markdown plans, atlas relationships, implementation files, tests, stories, checklist items, and possibly PR history. The output should be a reviewable proposal: confirmed evidence, implementation drift, open debt, likely superseded checklist items, suggested status changes, follow-up plans, and any follow-up atlas edits.

When the target project is also built with Ontahi, this review should get cheaper and more precise: atlas items can bind to Ontahi entities, operations, refs, and relations instead of forcing the agent to rediscover the system only from prose and code search.
