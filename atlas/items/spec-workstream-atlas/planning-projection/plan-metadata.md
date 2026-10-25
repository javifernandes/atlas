---
id: spec-workstream-atlas.planning-projection.plan-metadata
kind: capability
title: Plan Metadata
parent: spec-workstream-atlas.planning-projection
status: idea
horizon: later
supports:
  - spec-workstream-atlas.planning-projection
  - spec-workstream-atlas.atlas-model.plan
relatedPlans:
  - bookops://plans/99-semantic-editorial-workflows
  - plans/done/101-workstream-atlas-semantic-source.md
  - plans/done/107-plan-model-research-and-v0.md
  - plans/done/131-filename-derived-plan-id-presentation.md
---

Plan Metadata is the planning projection layer for describing [[spec-workstream-atlas.atlas-model.plan|Plan]] without forcing operational planning fields into the semantic product tree.

Likely fields include the stable filename-derived Plan key and its owning source, plan kind, scale, scheduling horizon,
parent and child links, GitHub Project mapping, ownership, implementation evidence, closure status,
and queryable planning attributes. Presentation surfaces should treat the key as identity metadata
rather than folding it into undifferentiated title text. Federated presentation qualifies local
keys with stable repository prefixes such as `ATL`, `BOK`, and `ONT` to avoid collisions.
The same qualified identity should remain visible when a Plan is opened in full detail, not only in
compact graph, board, search, or Session surfaces.

These fields should become useful only when the atlas needs an operational planning view, not before.
