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
  - plans/done/129-neon-egress-audit-and-containment.md
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

Normal page reads are revision-aware: a server process checks the latest Projection Revision
identity, reuses its parsed snapshot while that identity is unchanged, and transfers the full
snapshot only on a cold or changed revision. Successful reconciliation invalidates the local read
and presentation caches; other server instances discover the committed identity on their next
read. PostgreSQL query observations record metadata-only row counts, approximate result bytes,
duration, and trigger context so Projection Revision egress is visible outside the Neon UI.

The page-facing materialization is intentionally narrower than the durable revision. Initial
renders carry topology, summaries, metrics, evidence, and viewer-specific execution state, but omit
the multi-megabyte Markdown bodies. An authenticated node-content read resolves one body from the
same current revision when a reader opens full detail. This keeps the revision internally coherent
without making every page request serialize the entire federated source corpus.

PostgreSQL performs that page projection before the snapshot crosses the application boundary. It
removes each node and document `markdown` field from the latest revision inside the query, and a
separate parameterized read extracts one matching Markdown body for full detail. The server never
has to materialize the complete revision merely to discard most of its bytes.
