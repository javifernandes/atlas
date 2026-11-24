---
id: spec-workstream-atlas.atlas-experiences.history-and-evolution.release-story-projection
kind: capability
title: Release Story Projection
parent: spec-workstream-atlas.atlas-experiences.history-and-evolution
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-experiences.history-and-evolution
  - spec-workstream-atlas.goal.legible-system-evolution
relatedPlans:
  - plans/current/102-workstream-atlas-implementation-evidence.md
  - plans/current/159-work-classification-and-evolution-facets.md
  - plans/current/160-release-stories-and-item-evolution.md
---

Release Story Projection presents a Component Version or Release as an evidence-backed chapter of
system evolution.

It answers what became available, why the change exists, which Plans it advanced, which durable
Items and implementation Surfaces changed, what kind of work it contained, and where the line of
work continued. It groups Pull Requests and Changesets into a legible narrative without replacing
their source authority or treating a Release as proof that a Plan completed.

The projection is bidirectional. A Release can navigate to the Items it materialized or changed,
and an Item can show the versions in which its semantic form, implementation realization, or
availability evolved.

Release Story should appear progressively: compact availability signals in existing detail,
contextual explanation on demand, and a dedicated lens for the complete narrative and evidence.

The first implemented projection is a proportional observed-delivery timeline beneath Item
Evolution's Past / Now / Next / Later semantic map. It summarizes observation span and repository
count when meaningful, groups merged PR evidence by day with equal event spacing, and uses bubble
size to encode daily volume. Hover or keyboard focus exposes the date and individual PR detail.
This keeps delivery evidence connected to—but ontologically separate from—Plans and durable shapes,
while leaving room to distinguish complete Item history from a selected evolutionary line.

Published availability now appears on that same surface as a compact diamond on delivery time.
Atlas observes non-draft GitHub Releases, extracts their Changesets-generated Component Version
headings, and resolves only explicit release-note assertions. An Item inherits the signal when the
published version binds either to the Item itself or to a Plan already present in its evolution
map. Readable package/version and provenance detail lives in Source rather than in a competing
timeline hover, with exact npm version links when the Component uses npm package identity. The
release and version stay separate from raw PR chronology: publication is a
semantic checkpoint over delivery evidence, not another Pull Request bubble and not proof that a
Plan is complete.

Item timelines may include evidence bound to a Plan already shown in that Item's evolution map.
This inherited evidence is labeled `via <Plan>` and yields to direct Item evidence for the same
Pull Request, preserving the distinction between line-level chronology and a direct shape claim.

> [!DECISION]
> Target: [[spec-workstream-atlas.atlas-experiences.history-and-evolution|History And Evolution]]
>
> Treat raw delivery chronology as evidence and project explainable evolutionary moments over it.
> Keep semantic, implementation, and availability evolution distinct.
