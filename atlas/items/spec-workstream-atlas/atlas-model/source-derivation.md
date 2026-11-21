---
id: spec-workstream-atlas.atlas-model.source-derivation
kind: relation
title: Source Derivation
parent: spec-workstream-atlas.atlas-model.source
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model.projection-revision
relatedPlans:
  - plans/current/153-replication-and-adaptive-materialization.md
  - plans/done/154-unified-source-and-derivation-model.md
  - plans/current/156-adaptive-materialization-policy.md
---

Source Derivation separates stable dependency declaration from exact revision lineage.

At the Source level, an output Source `derivesFrom` one or more input Sources through a named,
versioned transformation. At the revision level, every produced Source Revision records
`SourceRevisionInput` edges to the exact input Source Revisions consumed.

```txt
Source A ─┐                         A@r10 ─┐
          ├─ transform v3 ─> C              ├─> C@r7
Source B ─┘                         B@r4  ─┘
```

The first runtime requires an acyclic declared dependency graph and immutable, acyclic revision
lineage. Rebuilding the same transformation version from the same ordered input revisions must
produce equivalent logical content, even if physical materialization differs.

Incremental derivation is an execution strategy for that same relationship, not a second semantic
model. A committed ChangeSet narrows the candidate inputs; a versioned Materializer uses declared
or discovered dependencies to compute the affected set, reuse compatible artifacts, and emit
derived artifact or Entity changes. Unknown dependencies, lineage gaps, or incompatible
Materializer versions require a full rebuild rather than a guessed partial result.

The generic integration boundary should first be behavioral: Ontahí owns a provider-neutral
Materializer SPI, while Atlas supplies Markdown parsing and semantic derivation behavior. After
Atlas and BookOps prove the common shape, Ontahí may add a declarative Entity-oriented authoring
surface that compiles to the SPI. The behavioral surface remains available for derivations that do
not fit one-file/one-Entity or another declarative subset.

Cooling, eviction, storage tiers, and restore policy are optional physical policies over
reconstructible outputs. They do not define Source Derivation and are not prerequisites for
incremental execution.

Atlas first represents each Markdown Source Record parse as a versioned artifact identified by the
record's canonical identity, content hash, and Materializer version. Per-record parsing remains
separate from cross-record alias resolution and semantic assembly, allowing unchanged artifacts to
be reused without pretending that all dependencies are record-local.

The first Atlas Materializer maps exact Source ChangeSet operations to affected record-artifact
identities. It emits a complete artifact set while invoking Markdown parsing only for affected or
incompatible records. Deletes and moves without retained dependency evidence request a full rebuild
rather than guessing which prior output must be removed. A full rebuild never reuses parsed
artifacts and remains the equivalence oracle.

The candidate reusable abstraction is not Markdown parsing itself but a media-neutral record
derivation envelope: `VersionedRecord -> DerivedArtifact<Payload>`. Stable record identity, content
fingerprint, transformation identity/version, serialized payload, observation lineage, and
dependency evidence may apply equally to Markdown, JSON, YAML, or source-code records. The parser
and cross-record assembler remain pluggable application behavior. Atlas must not promote this
candidate into a stable Ontahí API until BookOps supplies a second payload/topology and a later
non-Markdown case demonstrates which properties are truly independent of the medium.

A Projection Revision is therefore a specialized derived Source Revision, not merely a cache row.
Execution attempts and Task runs explain how derivation ran; they are not substitutes for accepted
revision lineage.
