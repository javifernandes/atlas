---
id: spec-workstream-atlas.atlas-model.implementation-component
kind: concept
title: Implementation Component
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: next
supports:
  - spec-workstream-atlas.atlas-model
  - spec-workstream-atlas.implementation-evidence
relatedPlans:
  - plans/done/111-atlas-as-ontahi-application.md
  - plans/next/102-workstream-atlas-implementation-evidence.md
exemplars:
  - "@bookops/model"
  - "@bookops/translator"
  - atlas
  - bookops-web
---

An [[spec-workstream-atlas.atlas-model.implementation-component|Implementation Component]] is a
durable, addressable unit that participates in the implementation of a system.

Packages, applications, services, CLIs, and workers can be Components when they have enough
identity to carry a responsibility, public boundary, release, deployment, or ownership decision.
Ordinary folders and modules should not become Components merely because they exist in the
filesystem.

Developers declare important Components in Markdown so their intended identity and relationship to
the conceptual system remain reviewable. Atlas reconciles those declarations with repository
evidence such as package manifests, paths, exports, deployment configuration, and release metadata.
Repository structure can reveal drift, but it does not author the entire system model by itself.

An Implementation Component is not a concrete build Artifact:

1. `@bookops/model` is a Component.
2. `@bookops/model@1.8.0` is a versioned realization or Artifact of that Component.
3. `@bookops/model/content` is an [[spec-workstream-atlas.atlas-model.implementation-surface|Implementation Surface]] exposed by that Component.

Components may realize Atlas Items such as capabilities, model concepts, experiences, or
operations. The relationship is many-to-many: one component can realize several conceptual items,
and one item can be materialized across several components.
