---
id: spec-workstream-atlas.atlas-model.participation
kind: concept
title: Participation
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: next
supports:
  - spec-workstream-atlas.atlas-model
  - spec-workstream-atlas.access-identity.workspace
relatedPlans:
  - plans/current/140-workspace-sources-and-contributor-discovery.md
  - plans/current/102-workstream-atlas-implementation-evidence.md
---

Participation is an evidence-derived relation between an actor and a scoped part of the Atlas graph.
It answers questions such as who contributed to a Source, worked on a Plan, shaped an Item, reviewed
a change, or produced an attributable artifact.

Participation is not Membership, authorship ownership, or authorization. An observed participant may
not have an Atlas account, and evidence of work never grants Workspace access by itself. A provider
account may be related to a Persistent User only after the account is explicitly linked and proven.

```text
Evidence(actor, action, target, time)
  -> Participation(scope, actor, roles, summary, explanation)
```

The scope can be a Source, Plan, Item, Workspace, or selected subgraph. Derivation may be simple,
such as actors on Pull Requests for one repository, or transitive, such as people who modified an
Item's Markdown or worked on Plans that shaped that Item. Presentation may render faces, names, and
compact activity summaries, but must retain an explainable path back to authoritative evidence.

The first implementation is contributor discovery for Workspace Sources. GitHub provider account ID
is the stable observed identity; login and avatar are presentation data, while commit email alone is
insufficient identity proof. Later slices can extend the same projection to Item and Plan detail
without inventing separate contributor lists for each surface.

## Evolution

The first projection materializes one row per Workspace Source and stable GitHub account. It records
merged Pull Request count, latest participation, actor kind, current presentation profile, and an
optional proven Atlas User link. Failed provider observations retain the last projection for that
Source. This intentionally small evidence policy can grow without changing the separation between
Participation and Membership.
