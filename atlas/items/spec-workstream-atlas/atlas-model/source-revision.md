---
id: spec-workstream-atlas.atlas-model.source-revision
kind: entity
title: Source Revision
parent: spec-workstream-atlas.atlas-model.source
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model.projection-revision
  - spec-workstream-atlas.atlas-model.reconciliation
relatedPlans:
  - plans/current/153-replication-and-adaptive-materialization.md
  - plans/done/154-unified-source-and-derivation-model.md
  - plans/done/155-changeset-and-replica-runtime.md
---

Source Revision is the immutable identity of one accepted logical state of a
[[spec-workstream-atlas.atlas-model.source|Source]]. It separates provider revision vocabulary from
the core lineage model and from whatever physical materialization currently serves that state.

## Data

| Field | Meaning |
| --- | --- |
| `source` | Portable Source Ref owning the revision |
| `revisionKey` | Opaque value within the Source's declared revision scheme |
| `revisionScheme` | Namespace such as `git`, `content-sha256`, or an Atlas sequence |
| `acceptedAt` | Time the owning authority accepted/observed this revision |
| `contentIdentity` | Optional deterministic logical-content identity |
| `provenance` | Provider observation, derivation, or Atlas-owned mutation evidence |

The tuple `SourceRef + revisionScheme + revisionKey` is stable. Git SHAs are one scheme rather than
the universal identity form. Accepted revisions are append-only; desired configuration and import
execution mutate elsewhere.

One Source may identify an accepted head without deleting historical revisions. A materialization
may be replaced or evicted while the logical revision and reconstruction lineage remain intact.

An accepted [[spec-workstream-atlas.atlas-model.change-set|ChangeSet]] names one base and one target
Source Revision. Revision mismatch is a consistency outcome rather than permission to infer or
merge missing operations.
