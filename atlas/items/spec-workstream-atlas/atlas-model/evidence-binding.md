---
id: spec-workstream-atlas.atlas-model.evidence-binding
kind: concept
title: Evidence Binding
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: next
supports:
  - spec-workstream-atlas.atlas-model
  - spec-workstream-atlas.implementation-evidence
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
  - plans/current/102-workstream-atlas-implementation-evidence.md
---

Evidence Binding links a model item to concrete proof: code, tests, migrations, stories, deployments, metrics, docs, or PRs.

Evidence is what lets the atlas answer whether an item exists only as intention, as implementation, or as validated product behavior.

The first observed binding is a merged GitHub Pull Request explicitly connected to an Atlas Item or
Plan through `Atlas-Implements` or `Atlas-Shapes`. GitHub owns the PR record; Atlas materializes a
`PullRequest` plus provenance-bearing `EvidenceBinding` in its Ontahi application and projects the
link into the target's evolution view.

A GitHub App webhook provides the authenticated merge signal and invalidates the relevant source
projection. It does not make the webhook payload authoritative, mirror the PR into Markdown, mutate
the target's curated status, or require persistence. Duplicate invalidations are harmless; durable
delivery deduplication begins only when Atlas adds an observed evidence index.
