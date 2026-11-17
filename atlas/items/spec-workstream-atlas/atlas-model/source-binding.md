---
id: spec-workstream-atlas.atlas-model.source-binding
kind: relation
title: Source Binding
parent: spec-workstream-atlas.atlas-model.source
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model.entity
relatedPlans:
  - plans/current/153-replication-and-adaptive-materialization.md
  - plans/done/154-unified-source-and-derivation-model.md
---

Source Binding is the normalized many-to-many relation connecting a subject Entity Ref to a
[[spec-workstream-atlas.atlas-model.source|Source]] Ref under a semantic role.

## Data

| Field | Meaning |
| --- | --- |
| `subject` | Entity Ref whose form or history uses the Source |
| `source` | Bound Source Ref |
| `role` | Meaning such as `definition`, `state`, `evidence`, or `activity` |
| `selector` | Optional Source-adapter selector for a record/subset |
| `provenance` | `declared`, `reflected`, `observed`, or `inferred` |
| `validity` | Optional Source Revision bounds |

An Entity `sources` map is authoring sugar over these relations. Each role always contains an array
of bindings. Provider, repository, owner, revision, and materialization metadata remain on Source
and Source Revision rather than being copied into the Entity.

Selectors are adapter-owned by default. A selector becomes portable structure only after multiple
Source adapters prove common semantics.
