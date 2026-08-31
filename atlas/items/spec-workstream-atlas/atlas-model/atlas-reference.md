---
id: spec-workstream-atlas.atlas-model.atlas-reference
kind: concept
title: Atlas Reference
parent: spec-workstream-atlas.atlas-model
status: idea
horizon: next
supports:
  - spec-workstream-atlas.atlas-model
  - spec-workstream-atlas.semantic-source
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
---

An Atlas Reference is an explicit pointer from source text to an atlas identity.

Declarations create named items. References point to named items from prose, plans, books, specs, or LaTeX-like sources. Exemplar references say that one item is a concrete case or referent of another item.

The same semantic graph should be recoverable from different source surfaces:

```md
The [[bookops.model.book|Book]] can be shared with a [[bookops.model.collaborator|Collaborator]].

The [Book](atlas:bookops.model.book) can be shared with a [Collaborator](atlas:bookops.model.collaborator).
```

```tex
\atlasDeclare{bookops.model.book}{kind=entity, title="Book"}
\atlasTypeOf{bookops.model.book}{ontahi.model.entity}
\atlasRef{bookops.model.book}
```

The extractor should treat syntax as an input surface and produce normalized atlas ids, relations, unresolved references, and evidence links.
