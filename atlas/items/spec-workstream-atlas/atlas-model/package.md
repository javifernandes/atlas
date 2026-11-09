---
id: spec-workstream-atlas.atlas-model.package
kind: concept
title: Package
parent: spec-workstream-atlas.atlas-model.item-type
status: shaping
horizon: now
relatedPlans:
  - plans/current/146-package-manifest-and-classroom-model.md
exemplars:
  - ontahi.examples.classroom
---

A Package is a repository-local semantic and implementation ownership boundary. It groups model
definitions with the code, tests, and other implementation components that realize them without
equating a monorepo Source with one system.

Packages declare themselves through `atlas.package.md`. Their local Atlas Items remain ordinary
stable declarations under `<package-root>/atlas/items/` and opt into containment through explicit
`parent` ids. The manifest makes the boundary discoverable; it does not infer semantic ownership
from arbitrary folders or `package.json` alone.

Package is the first concrete bridge between source-control structure and the Atlas model. A
manifest may declare `packageName` as its ecosystem identity and `packageType` as its semantic role;
Atlas derives `packagePath` from the manifest location and exposes links to both the implementation
root and manifest. It can later describe dependencies, exports, runtime role, realized Concepts,
and implementation evidence without duplicating the package manager's entire manifest.

Package containment is structural rather than temporal. Contained Entities, Operations, and other
durable Items belong in the Package's graph, Overview, and Context; its Evolution view admits only
associated Plans as staged entries. That view aggregates Plans associated directly with the Package
and with any Item in its transitive containment subgraph, deduplicating a Plan that shapes several
descendants. Implementation evidence and explicit semantic signals can still explain change without
pretending every child Item occupies Past, Now, Next, or Later.
