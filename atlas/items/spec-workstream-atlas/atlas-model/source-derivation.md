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
  - plans/next/156-adaptive-materialization-policy.md
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

A Projection Revision is therefore a specialized derived Source Revision, not merely a cache row.
Execution attempts and Task runs explain how derivation ran; they are not substitutes for accepted
revision lineage.
