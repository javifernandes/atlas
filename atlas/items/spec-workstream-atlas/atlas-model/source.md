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
  - plans/next/154-unified-source-and-derivation-model.md
  - plans/next/155-changeset-and-replica-runtime.md
  - plans/next/156-adaptive-materialization-policy.md
  - plans/backlog/157-atlas-editing-and-git-write-back.md
---

A Source is addressable, revisioned state that Atlas can observe from an owner or derive through a
declared transformation. Git-backed Markdown, provider evidence, Atlas-owned collaboration state,
and semantic projections may all participate in one flat Source graph without pretending they have
the same authority, durability, or reconstruction policy.

## Provisional model

A Source needs:

1. stable identity and owner;
2. an observation or derivation contract;
3. a revision scheme;
4. declared capabilities such as readable, writable, replayable, or reconstructible;
5. exact lineage when one revision derives from other Source Revisions;
6. a durability/materialization policy distinct from its logical meaning.

`authoritative`, `Atlas-owned`, and `derived` are roles or capabilities in this graph, not separate
root models. A derived Source relates to its input Sources and records the exact input revisions for
each produced revision. This allows the same logical Source Revision to be hot, checkpointed,
replayed, restored, or evicted when its reconstruction contract permits.

## Entity bindings

Entities may expose a convenient `sources` map or array keyed by roles such as `definition`,
`state`, `evidence`, or `activity`. Atlas normalizes those declarations into first-class
Entity-to-Source bindings with selectors and provenance. The authoring shape therefore reflects
Sources from Entities without copying Source identity, ownership, revision, and lineage into opaque
Entity metadata.

A database table or cache is not automatically a Source. It earns Source identity only when Atlas
can name what state it represents, how it is revised, who owns it, and how it is observed or
reconstructed.

## Execution boundary

A Unit of Work records execution intent and lifecycle. A successful Unit of Work may produce one
or more ChangeSets; a ChangeSet describes accepted operations advancing one Source from a base
revision to a target revision. Session and Principal attribution belong on the execution and
resulting change provenance, while Source Revision remains the durable state identity.

The initial runtime remains single-authority per Source. Future Atlas editing may produce pending
outbound ChangeSets and publish them through the provider, but provider confirmation advances the
accepted Git-backed lineage.
