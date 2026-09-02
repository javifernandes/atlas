---
id: spec-workstream-atlas.atlas-model.evidence-binding
kind: concept
title: Evidence Binding
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model
  - spec-workstream-atlas.implementation-evidence
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
  - plans/current/102-workstream-atlas-implementation-evidence.md
  - plans/current/116-atlas-ontahi-postgres-persistence.md
---

Evidence Binding links a model item to concrete proof: code, tests, migrations, stories, deployments, metrics, docs, or PRs.

Evidence is what lets the atlas answer whether an item exists only as intention, as implementation, or as validated product behavior.

The first observed binding is a merged GitHub Pull Request explicitly connected to an Atlas Item or
Plan through `Atlas-Implements` or `Atlas-Shapes`. GitHub owns the PR record; Atlas materializes a
`PullRequest` plus provenance-bearing `EvidenceBinding` in its Ontahi application and projects the
link as implementation evidence attached to the target.

An Evidence Binding is not another semantic evolution node. Plans and model forms can occupy past,
now, next, or later stages; a Pull Request instead provides observed implementation evidence for the
target it binds. Merged PRs are completed evidence, open PRs may later appear as in-progress
evidence, and PRs never occupy future stages.

The attached evidence row foregrounds the Pull Request title, number, and compact relative merge
age. Repository and assertion provenance stay in the evidence model without occupying the default
presentation. GitHub actors appear as a compact avatar stack: the projection observes the PR author
and the user who merged it, deduplicates one person carrying both roles, and exposes role detail on
hover. GitHub's avatar URLs remain observed presentation metadata rather than Atlas-authored
Markdown.

A GitHub App webhook provides an authenticated merge or repository-push signal. It does not make
the webhook payload authoritative, mirror a PR into Markdown, or mutate the target's curated
status. The signal invokes source reconciliation, while GitHub remains the authority observed by
that operation.

Plan 116 introduces that index through Ontahi and PostgreSQL on Neon. The persisted binding keeps
its evidence id, target id, assertion kind, source authority, and observation revision; it does not
turn Atlas into the owner of the referenced Pull Request. Durable delivery identity makes repeated
webhooks converge across server instances. Reconciliation is serialized, preserves bindings for a
temporarily unavailable evidence source, and refreshes the authoritative GitHub record when that
source recovers.
