---
id: spec-workstream-atlas.atlas-model.projection-revision
kind: entity
title: Projection Revision
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.semantic-source
  - spec-workstream-atlas.atlas-model.evidence-binding
  - spec-workstream-atlas.atlas-model.reconciliation
relatedPlans:
  - plans/done/116-atlas-ontahi-postgres-persistence.md
  - plans/current/102-workstream-atlas-implementation-evidence.md
---

Projection Revision is the durable operational observation served by Atlas. It records one trigger,
the reconciled source-revision set, completion state, diagnostics, and a serializable read snapshot
containing nodes, topology, and implementation evidence from the same PostgreSQL transaction.

The revision does not become authority for its contents. Markdown, GitHub, repository history,
registries, and release providers remain the sources Atlas can observe again. Retaining revision
identity and provenance makes a read explainable, lets repeated bootstrap or rebuild converge, and
gives later Changeset and Release ingestion a stable historical index.

Only a committed revision is visible to normal page reads. Reconciliation serializes through a
durable PostgreSQL lock, rejects an observation older than the latest committed revision, and marks
the result `degraded` when one evidence provider is unavailable without deleting that provider's
last successful bindings.

The first production cutover was completed through Plan 116: deployed page and Runtime Protocol
reads use the same Neon-backed composition, and an explicit production rebuild verified recovery
against the persisted source, topology, and evidence projection.
