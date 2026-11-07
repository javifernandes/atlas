---
id: spec-workstream-atlas.atlas-model.reconciliation
kind: operation
title: Reconciliation
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model.current-system-form
  - spec-workstream-atlas.atlas-model.form-transformation
  - spec-workstream-atlas.atlas-model.evidence-binding
  - spec-workstream-atlas.atlas-experiences.history-and-evolution
  - spec-workstream-atlas.assisted-editing.plan-status-review
relatedPlans:
  - plans/done/116-atlas-ontahi-postgres-persistence.md
  - plans/done/130-github-merge-catch-up.md
  - plans/next/106-atlas-plan-reconciliation-operation.md
  - plans/done/104-atlas-source-shape-v0.md
  - plans/current/144-workspace-source-reconciliation-and-history.md
---

[[spec-workstream-atlas.atlas-model.reconciliation|Reconciliation]] is the operation family that compares intention, implementation, evidence, and the current atlas model.

It answers the questions that currently happen in chat:

1. what did this work item intend to change?
2. what actually landed?
3. what changed during implementation?
4. what remains open?
5. what was superseded, abandoned, or invalidated?
6. what atlas items, relations, plans, or evidence should be updated?

The first concrete operation is `ReviewPlanState`: given one plan and enough repo context, produce a read-only proposal with landed work, drift, open work, follow-ups, atlas item updates, and human questions.

Later reconciliation operations can run from PR merges, GitHub pushes, manual Atlas UI actions, or user-instructed assisted editing.

Atlas now also has an operational source-reconciliation primitive. Signed `push` and merged-PR
deliveries, manual bootstrap, and explicit rebuild all observe the configured authorities and
commit one provenance-bearing PostgreSQL Projection Revision through Ontahi. This primitive is not
`ReviewPlanState`: it converges the operational graph without deciding whether curated intent is
complete. A durable lock serializes reconcilers, older observations cannot overwrite newer ones,
and degraded evidence sources retain their last successful bindings.

Webhook recovery is a distinct operational reconciliation mode. It re-observes a bounded GitHub
history and compares stable Pull Request identities with durable Session activity, so a failed
delivery can be recovered without inventing delivery provenance or relying on a timestamp that may
already have advanced through evidence-only reconciliation. Preview is read-only; apply converges
the projection once and appends only missing attributable activity. Operators must also provide a
reviewed ISO-8601 lower bound: it limits recovery scope without replacing stable identity as the
deduplication checkpoint, and the committed Projection Revision records that bound in diagnostics.

Workspace adoption introduces a second, explicitly partitioned operational form. A registered
Workspace Source is desired configuration; a Source import execution records the attempt and its
trigger, while an immutable Workspace projection revision records only successfully converged
state. Failed or cancelled executions remain history and never replace the last completed
projection. This execution identity is also the future boundary for progress, cancellation, and
declared compensation without treating every arbitrary external effect as automatically reversible.
GitHub Sources retain the App installation that authorizes them. Signed push and merged-PR events
fan out only to Sources matching both repository and installation, producing independent Workspace
executions instead of treating the legacy global projection as multi-tenant state.
Workspace Settings presents these executions as operational History rather than Source
configuration. Each entry keeps its trigger, lifecycle, timing, repository, and provider revision
navigable so owners can diagnose stale or failed projections without reconstructing webhook logs.
