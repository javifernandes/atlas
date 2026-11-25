---
id: spec-workstream-atlas.atlas-model.work-item.work-classification
kind: item
title: Work Classification
parent: spec-workstream-atlas.atlas-model.work-item
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model.work-item
  - spec-workstream-atlas.atlas-experiences.history-and-evolution
relatedPlans:
  - plans/current/159-work-classification-and-evolution-facets.md
  - plans/current/160-release-stories-and-item-evolution.md
---

Work Classification describes reusable facets of a temporal intervention without replacing the
durable subject that the work shapes.

A Plan or Pull Request can be a `refactor`, affect a `public-surface`, and require a `migration`
while shaping an Item such as Ontahí Source Organization. The facets help readers group and filter
history; the typed relation to the Item explains what the work was about.

The initial model keeps four concerns distinct:

1. work nature, such as feature, fix, refactor, migration, maintenance, research, or documentation;
2. domain or audience, such as technical;
3. impact scope, such as internal, public surface, consumer behavior, data shape, or operational;
4. compatibility pressure, such as compatible, migration required, breaking, or unknown.

Atlas starts with a bounded vocabulary and preserves authored or observed provenance. It should
not require historical work to be classified, infer compatibility from `refactor`, or promote
every reusable facet into an Atlas Item. Workspace-custom vocabularies remain a later option that
must be earned by real cases.

> [!DECISION]
> Target: [[spec-workstream-atlas.atlas-model.work-item|Work Item]]
>
> Separate what kind of work occurred from the durable system subject it shaped. Use facets for
> the former and typed Atlas relations for the latter.
