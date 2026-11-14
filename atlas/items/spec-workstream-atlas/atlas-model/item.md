---
id: spec-workstream-atlas.atlas-model.item
kind: concept
title: Atlas Item
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model
  - spec-workstream-atlas.atlas-experiences.atlas-shaping
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
  - plans/backlog/105-atlas-shaping.md
  - plans/next/108-atlas-item-type-model.md
exemplars:
  - bookops
  - ontahi
  - spec-workstream-atlas
  - bookops.model.book
  - ontahi.model.domain-operation
---

An [[spec-workstream-atlas.atlas-model.item|Atlas Item]] is a durable thing the atlas can name, relate, inspect, and keep reshaping over time.

`node` is a graph/UI implementation word. `Item` is the current product-language noun. `Shape` stays a verb: plans, operations, and practices shape atlas items over time.

An item may be a project, package, model, experience, principle, practice, capability, entity, operation, artifact, policy, evidence group, or work item. The important property is not its category; it is that the project needs to keep giving it form as plans, code, prototypes, and evidence evolve.

Projects are items too. BookOps, Ontahi, and Workstream Atlas all show how something can begin inside another project and later gain enough identity to become a project-level item with its own repositories, paths, evidence, and planning surface.

Packages are Items too, but they are not Projects or Repository Sources. A Package is a local
semantic and implementation ownership boundary that can contain Entities, Experiences, Operations,
and the components that realize them.

`kind`, `parent`, and `typeOf` answer different questions. `kind` selects the Item's immediate
authoring and presentation shape. `parent` places it in a semantic ownership hierarchy. `typeOf`
relates it to the most specific authored Item type or specialization it conforms to. Broader type
membership follows direct `typeOf` edges; containment never implies typing.

Containment and evolution are also independent. Durable structural Items such as Entities,
Operations, Packages, and Concepts belong in Overview, Context, and the semantic graph; they do not
occupy temporal Evolution stages merely because they are children. Evolution stages admit temporal
work Items. Today that means Plans; future types such as Tasks may opt in explicitly rather than
inheriting temporal behavior from generic Item containment.

## Child Items

1. [`Atlas Item Type`](./item-type.md)
