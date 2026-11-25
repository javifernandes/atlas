---
id: spec-workstream-atlas.atlas-model.source
kind: concept
title: Source
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.semantic-source
  - spec-workstream-atlas.atlas-model.entity
  - spec-workstream-atlas.atlas-model.projection-revision
  - spec-workstream-atlas.atlas-model.reconciliation
relatedPlans:
  - plans/current/153-replication-and-adaptive-materialization.md
  - plans/done/154-unified-source-and-derivation-model.md
  - plans/done/155-changeset-and-replica-runtime.md
  - plans/current/156-adaptive-materialization-policy.md
  - plans/current/163-incremental-github-evidence-replication.md
  - plans/backlog/157-atlas-editing-and-git-write-back.md
---

A Source is addressable, revisioned state that Atlas can observe from an owner or derive through a
declared transformation. Git-backed Markdown, provider evidence, Atlas-owned collaboration state,
and semantic projections may all participate in one flat Source graph without pretending they have
the same authority, durability, or reconstruction policy.

## Model v0

A Source needs:

1. stable identity and owner;
2. an observation or derivation contract;
3. a revision scheme;
4. declared capabilities such as readable, writable, replayable, or reconstructible;
5. exact lineage when one revision derives from other Source Revisions;
6. a durability/materialization policy distinct from its logical meaning.

Source is a portable Entity and canonical Operation receiver. `SourceRef` carries semantic identity
across process and Runtime Protocol boundaries. Repository names, provider URLs, and structurally
similar ID objects are adapter/configuration data, not substitutes for the Ref.

`authoritative`, `Atlas-owned`, and `derived` are roles or capabilities in this graph, not separate
root models. A derived Source relates to its input Sources and records the exact input revisions for
each produced revision. This allows the same logical Source Revision to be hot, checkpointed,
replayed, restored, or evicted when its reconstruction contract permits.

## Capabilities

Sources compose capabilities rather than belonging to a closed provider hierarchy:

| Capability | Meaning |
| --- | --- |
| `observable` | Resolve a current or requested revision through an adapter. |
| `derivable` | Produce revisions from exact input revisions through a named transformation. |
| `writable` | Accept an authorized proposed or direct ChangeSet. |
| `replayable` | Reconstruct from checkpoint plus ordered accepted ChangeSets. |
| `reconstructible` | Reproduce logical state from declared inputs after materialization eviction. |

An external Git Source may be observable and writable while Git remains acceptance authority. An
Atlas semantic Source may be derivable and reconstructible. Atlas-owned collaboration state may be
writable without being safely reconstructible.

## Entity bindings

Entities may expose a convenient `sources` map or array keyed by roles such as `definition`,
`state`, `evidence`, or `activity`. Atlas normalizes those declarations into first-class
Entity-to-Source bindings with selectors and provenance. The authoring shape therefore reflects
Sources from Entities without copying Source identity, ownership, revision, and lineage into opaque
Entity metadata.

Every role maps to an array of bindings. `SourceBinding` retains subject Entity Ref, Source Ref,
role, optional adapter selector, provenance, and optional revision validity. Atlas normalizes
author-declared maps, reflected model metadata, and observed provider relationships into this same
many-to-many form.

A database table or cache is not automatically a Source. It earns Source identity only when Atlas
can name what state it represents, how it is revised, who owns it, and how it is observed or
reconstructed.

GitHub Pull Request evidence is one such Source. GitHub remains its authority; Atlas accepts a
repository-scoped `updated_at` frontier and normalized relevant PR records as a reconstructible
replica. The frontier is provider observation state rather than PR identity, and incremental
observation must retain an inclusive boundary so equal timestamps cannot hide edited historical
records.

The provider-neutral runtime for such a replica should use the application's active Ontahi Entity
storage by default for accepted frontiers and records. This keeps replication inside the same
transactional and portability boundary as the rest of the application. A distinct storage adapter
is an optional capability for applications that intentionally split stores; it is not part of the
minimum Source declaration.

## Execution boundary

A Unit of Work records execution intent and lifecycle. A successful Unit of Work may produce one
or more ChangeSets; a ChangeSet describes accepted operations advancing one Source from a base
revision to a target revision. Session and Principal attribution belong on the execution and
resulting change provenance, while Source Revision remains the durable state identity.

The initial runtime remains single-authority per Source. Future Atlas editing may produce pending
outbound ChangeSets and publish them through the provider, but provider confirmation advances the
accepted Git-backed lineage.

## Local development observation

A checked-out directory can be an observable Source adapter without becoming a second authority.
Atlas identifies its revision from the semantic files' content hash. Filesystem notifications are
only hints that a fresh observation may produce a new revision; they are debounced, may be
duplicated or lost, and never mutate the graph directly.

The development adapter therefore serializes reconciliation and retains full observation as its
repair path. Its first adoption automatically rebuilds the local Workspace projection after
startup and relevant Markdown changes. A later adoption can derive an exact filesystem ChangeSet
and feed the same versioned Materializer used by remote Git events without changing Source or
Projection Revision semantics.

## Relations

- [[spec-workstream-atlas.atlas-model.source-revision|Source Revision]] gives one Source an immutable
  accepted state identity.
- [[spec-workstream-atlas.atlas-model.source-binding|Source Binding]] relates Entities to Sources by
  semantic role.
- [[spec-workstream-atlas.atlas-model.source-derivation|Source Derivation]] declares stable Source
  dependencies and exact revision lineage.
- [[spec-workstream-atlas.atlas-model.change-set|ChangeSet]] advances one Source between exact
  revisions through replayable operations.

`AtlasWorkspaceSource` currently represents desired Workspace registration and is the adoption
precursor for `SourceRef`. It must not be conflated with an observed Source Revision or its import
execution. Plan 155 can adopt the v0 contract incrementally without first renaming every physical
table.
