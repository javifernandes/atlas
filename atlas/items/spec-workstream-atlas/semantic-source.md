---
id: spec-workstream-atlas.semantic-source
kind: tooling
title: Semantic Source
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: now
supports:
  - spec-workstream-atlas
  - spec-workstream-atlas.atlas-model
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
  - plans/done/111-atlas-as-ontahi-application.md
  - plans/done/101-workstream-atlas-semantic-source.md
---

Semantic Source is the federated Markdown corpus that defines the atlas. Each source remains editable
by humans, reviewable in its own Git repository, and simple enough for LLM agents to reorganize
safely.

Atlas-owned declarations are loaded intrinsically from this repository. External sources are
registered once and addressed through stable logical identities such as
`ontahi://atlas/model/selection` and `ontahi://plans/128-data-graph-execution-bridge`. Atlas prefers
a configured sibling checkout during local development and falls back to a cached public GitHub
source when that checkout is absent. Semantic IDs remain global across the mounted files, so moving
ownership does not create a second graph or require UI-specific copies.

Loaded files cross into Atlas through a normalized source record that keeps physical location and
semantic identity separate: `sourceId`, repository-relative `sourcePath`, canonical URI, and an
optional source file path. Repository-local Plan references are resolved inside the declaring
source, while already canonical URIs keep their explicit cross-source ownership. This lets authors
continue writing ordinary `plans/...md` references without losing links once the repository is
mounted as a federated source.

A source repository may retain a small relocation stub after transferring a Plan to another
authority. Atlas reads `Canonical ID` from that stub as an identity alias: references to the old
source URI resolve to the canonical Plan, while the stub itself is not materialized as a second
Plan or document. This keeps historical links navigable without letting source-folder status on a
redirect override the canonical repository's status.

Inside the Atlas process, normalized records pass through one shared semantic parser contract for
the Plan and Atlas Item shapes consumed by the compatibility snapshot and the Ontahi dataset. The
application therefore hydrates before viewer-specific node and edge derivation. Its headless reads
use the application-bound graph API so the exact storage runtime and query terminal remain explicit.
The Ontahi Runtime Protocol belongs at a later transport boundary—browser, GitHub worker, or
external agent—not between Markdown parsing and an in-process build projection.

During the static build, Atlas queries Ontahi for Item containment, support and shaping bindings,
plus Plan containment and lateral relations. One serializable topology projection feeds the global
map, board, selection panel, and full-detail Context and Evolution tabs. The compatibility snapshot
still supplies node cards, Markdown documents, metrics, status grouping, and other presentation
metadata; it no longer supplies a second relation graph. Semantic signals and temporal grouping
remain viewer-derived lenses over the application-owned relations.

The first source-aware Ontahi operation, `AtlasItem.proposePlanLink`, resolves an existing Item and
Plan and returns a source-owned unified diff. Source-local links use repository paths and
cross-source links keep canonical URIs. The operation is available through Atlas's Runtime Protocol
endpoint, but it does not mutate Markdown; authenticated apply and provenance remain a separate
reviewed boundary.

Its current contract is captured in [`atlas/SOURCE-SHAPE.md`](../../SOURCE-SHAPE.md).
