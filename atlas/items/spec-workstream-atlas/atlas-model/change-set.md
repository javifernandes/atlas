---
id: spec-workstream-atlas.atlas-model.change-set
kind: entity
title: ChangeSet
parent: spec-workstream-atlas.atlas-model.source
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model.source-revision
  - spec-workstream-atlas.atlas-model.reconciliation
relatedPlans:
  - plans/current/153-replication-and-adaptive-materialization.md
  - plans/done/155-changeset-and-replica-runtime.md
  - plans/backlog/157-atlas-editing-and-git-write-back.md
---

ChangeSet is the immutable description of accepted operations that advance one
[[spec-workstream-atlas.atlas-model.source|Source]] from an exact base
[[spec-workstream-atlas.atlas-model.source-revision|Source Revision]] to a target revision.

It is not the Unit of Work that attempted execution. A Unit of Work owns intent, lifecycle,
Principal and Session context, and may fail without producing a ChangeSet. The ChangeSet records
the resulting state transition, provider provenance, optional execution attribution, and ordered
operations suitable for deterministic replay.

## Runtime v0

The first Atlas adoption targets file-shaped Git/Markdown Sources:

| Operation | Meaning |
| --- | --- |
| `create` | Add one record at a previously absent Source path. |
| `update` | Replace record content after matching its prior content hash. |
| `delete` | Remove a record after matching its content hash. |
| `move` | Move identical content between Source paths. |

Filesystem `move` is a first-level Source operation. A future collection `$move` is a field
operator inside an Entity/value update and belongs to a different semantic layer.

ChangeSet identity is deterministic over Source, base revision, target revision, and canonicalized
operations. Application has three outcomes:

1. `applied` when current revision equals the base and every record precondition holds;
2. `duplicate` when current revision already equals the target;
3. `base-mismatch` when current revision is neither base nor target.

No operation is guessed after `base-mismatch`. Git push observation additionally checks
`push.before` against the persisted Source Revision; a gap selects full snapshot observation.

## Persistence and projection

Atlas persists observed ChangeSets separately from their application records. One application
links the accepted ChangeSet to the Projection Revision that published its effects. Provider
delivery identity, attribution, operations, and diagnostics remain durable even while the current
semantic publication still rebuilds from the complete composed record set.

This first slice makes source-record convergence incremental and auditable. Parsed semantic
artifacts and graph publication remain global so equivalence with full reconciliation stays behind
one existing atomic transaction.
