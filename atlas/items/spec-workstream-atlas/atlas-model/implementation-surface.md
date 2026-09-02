---
id: spec-workstream-atlas.atlas-model.implementation-surface
kind: concept
title: Implementation Surface
parent: spec-workstream-atlas.atlas-model.implementation-component
status: shaping
horizon: next
supports:
  - spec-workstream-atlas.atlas-model
  - spec-workstream-atlas.atlas-model.implementation-component
  - spec-workstream-atlas.implementation-evidence
relatedPlans:
  - plans/done/111-atlas-as-ontahi-application.md
  - plans/current/102-workstream-atlas-implementation-evidence.md
exemplars:
  - "@bookops/model/content"
  - "@ontahi/core/data-graph"
---

An [[spec-workstream-atlas.atlas-model.implementation-surface|Implementation Surface]] is a stable or
meaningful boundary that an
[[spec-workstream-atlas.atlas-model.implementation-component|Implementation Component]] exposes to
consumers.

A Surface may be a package export, HTTP API, operation bridge, CLI command, event channel, schema,
UI route, or reusable React entrypoint. It is narrower than the owning Component and more durable
than an arbitrary file or symbol.

Developers should declare Surfaces when their compatibility, consumers, release impact, or
relationship to Atlas Items matters. Atlas can then compare the declaration with actual exports,
routes, schemas, and Changeset metadata.

Surfaces provide the bridge between conceptual and implementation evolution:

```txt
Atlas Item
  <- realized by - Implementation Surface
      <- exposed by - Implementation Component
          <- changed by - PR / Changeset
              <- materialized in - Package Version / Release
```

Not every internal module deserves a Surface. A Surface earns a durable declaration when other
parts of the system depend on it or when changing it should be visible in planning and release
history.
