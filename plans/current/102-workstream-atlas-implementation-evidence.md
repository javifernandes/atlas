# 102. Atlas Implementation And Release Evidence

Status: current

Depends on: [111. Atlas As An Ontahi Application](../done/111-atlas-as-ontahi-application.md)

Persistence foundation:
[116. Atlas Ontahi PostgreSQL Persistence](../done/116-atlas-ontahi-postgres-persistence.md)

## Summary

Connect curated Atlas Items and Plans to the implementation components, public surfaces,
Changesets, pull requests, package versions, releases, and deployments that materialize them.

Developers should declare durable Implementation Components and their important Surfaces in
Markdown just as they declare Plans and other Atlas Items. Atlas keeps those declarations synced
with repository structure. Volatile implementation history remains owned by GitHub, Changesets,
package registries, and deployment providers; Atlas extracts or caches that metadata instead of
copying it into Markdown.

The resulting experience should be navigable in both directions:

1. from a Plan or Atlas Item, see which component versions and releases implemented it;
2. from a package version or release, see its Changesets, PRs, Plans, changed Surfaces, and model
   evolution.

## Context

Atlas currently explains semantic intent while implementation and release history live elsewhere:

1. PRs and commits show code changes but not the durable system form they shaped.
2. Changesets describe package-level release intent and semantic version impact, but Atlas does not
   connect them to Plans, Components, Surfaces, or model evolution.
3. Package registries show published versions but not why those versions exist.
4. Plans record intended interventions but not always the first released version in which they
   became available.
5. Atlas Items describe the current conceptual system but cannot yet show how that form evolved
   across releases.

Atlas now owns a GitHub App and webhook receiver. A GitHub webhook provider verifies and normalizes
a delivery, the generic graph HTTP ingress router selects a declared channel, and a server-only
Ontahi operation performs the application work. The first slice deliberately invalidates the
ephemeral projection instead of storing the event. That was sufficient for merged-PR evidence, but
Changesets and release correlation need a durable history across serverless instances and deploys.

This capability follows [Plan 111](../done/111-atlas-as-ontahi-application.md). Ontahi now gives
Atlas a model and operation layer in which curated declarations and observed evidence can coexist
without pretending they have the same authority or storage lifecycle.

## Research / Evidence

1. Ontahi uses Changesets to describe versioned package changes and provides the first real pilot;
   BookOps has package boundaries that can adopt the same model later.
2. A Changeset names affected packages, semantic version increments, and a human explanation before
   release aggregation removes or transforms the source file.
3. GitHub remains authoritative for PR identity, merge state, commits, actors, and links.
4. The package registry or release provider remains authoritative for published package versions.
5. [[spec-workstream-atlas.implementation-evidence|Implementation Evidence]] already names the
   product need for code, coverage, Storybook, and preview bindings.
6. [[spec-workstream-atlas.atlas-model.implementation-component|Implementation Component]] and
   [[spec-workstream-atlas.atlas-model.implementation-surface|Implementation Surface]] distinguish
   durable declared implementation structure from concrete versioned artifacts.
7. [109. Work Item Impact Surface](./109-work-item-impact-surface.md) provides the `shapes`,
   `affects`, `preserves`, `breaks`, and `restores` vocabulary for relating work to system form.
8. `@ontahi/core@1.0.0-alpha.11`, consumed by Atlas, exposes graph HTTP ingress routing and operation
   dispatch. `@ontahi/runtime-nextjs@1.0.0-alpha.11` exposes the shared Next.js Runtime Protocol
   adapter, while `@ontahi/postgres@1.0.0-alpha.11` supports the selected Relation projections used
   by the durable evidence read model.
9. Ontahi's Changesets configuration uses a fixed group for its public packages. A release may
   therefore publish several Component Versions together without turning the group itself into a
   Component.

## Scope

1. Register and integrate an Atlas GitHub App with minimal repository read permissions and merged
   pull-request webhook events.
2. Bind Plans and Atlas Items to merged PRs using explicit, deterministic author assertions.
3. Define Markdown declarations for durable Implementation Components and important Surfaces.
4. Validate or reconcile those declarations against package manifests, paths, exports, routes, or
   other repository evidence.
5. Extract Changeset metadata and preserve its relationship to the PR and merge commit that carried
   it.
6. Model package versions, releases, and their included Changesets without treating them as curated
   Markdown Items.
7. Support provenance-bearing inferred bindings after explicit and deterministic evidence works.
8. Render Plan/Item-to-version and version-to-change projections.
9. Establish data ownership, refresh, idempotency, and historical retention rules.

## Non-Goals

1. Do not store a Markdown file for every PR, commit, Changeset occurrence, or package release.
2. Do not turn Atlas into a package registry, release orchestrator, or CI replacement.
3. Do not automatically mark a Plan or Atlas Item `done` because a related PR merged.
4. Do not declare every folder, module, export, or changed file as a first-class Component or
   Surface.
5. Do not require LLM inference for deterministic package, Changeset, PR, or release relationships.
6. Do not make the persistent Atlas projection replace Markdown, GitHub, repository history, or
   package registries as semantic authorities.
7. Do not mutate Plan or Item status from a merged PR.
8. Do not implement Changeset, release, or database ingestion in the first merged-PR slice.

## Proposed Form

### Curated component declarations

A developer declares a durable implementation boundary in Markdown:

```yaml
---
id: ontahi.implementation.core-package
kind: implementation-component
title: Ontahi Core Package
componentType: package
repository: javifernandes/ontahi
path: packages/core
package: "@ontahi/core"
versionProvider: npm
releaseGroup: ontahi-public-packages
versionPolicy: fixed
realizes:
  - ontahi.model.application
surfaces:
  - ontahi.implementation.core-runtime-protocol-surface
---
```

An important consumer boundary can be declared separately:

```yaml
---
id: ontahi.implementation.core-runtime-protocol-surface
kind: implementation-surface
title: Ontahi Core Runtime Protocol Surface
component: ontahi.implementation.core-package
locator: "@ontahi/core/runtime/protocol"
realizes:
  - ontahi.runtime-protocol
---
```

The exact frontmatter keys remain a design output of this plan. The important distinction is that a
Component is a durable unit with identity and version history, while a Surface is a boundary it
exposes to consumers. A Surface participates in a Component Version's change set; it does not
receive an independent version unless it later earns identity as its own Component.

### Intent, realization, and observed delivery

Plans and Atlas Items both relate to Components and Surfaces, but they do not use the same
relationship:

1. an Atlas Item is `realizedBy` one or more Surfaces, or by a Component when a finer boundary is
   not useful;
2. a Plan may declare the Components and Surfaces it intends to `affect` or `target`;
3. a PR `implements` the Plan, `shapes` durable Atlas Items, and changes implementation boundaries;
4. a Changeset describes the semantic version impact on named package Components;
5. the Component Version that materialized a Plan or Item is derived through the observed
   PR/Changeset/release chain rather than copied into curated Markdown.

These are many-to-many relationships. One Plan may cross several Components, one Component may
participate in many Plans, and one conceptual Item may be realized across several Surfaces.

### Observed evidence model

```txt
Plan / Atlas Item
  <- shapes / implements / evidences - PR
  <- described by -------------------- Changeset
  <- materialized in ----------------- Component Version

PR
  -> changes ------ Implementation Component / Surface
  -> contains ----- Changeset
  -> merged as ---- Commit

Release
  -> publishes ---- Component Version
  -> includes ----- Changeset
  -> advances ----- Plan / Atlas Item
```

`@ontahi/core` is an Implementation Component. `@ontahi/core/runtime/protocol` is a Surface.
`@ontahi/core@1.0.0-alpha.10` is a Component Version. An Ontahi release may aggregate that version
with versions of other packages governed by the same fixed Changesets group. These are related but
not interchangeable concepts.

`ComponentVersion` is a first-class observed entity rather than a scalar field or curated Markdown
Item. It needs identity and relations of its own so Atlas can navigate from one version to its
Changesets, PRs, Plans, Atlas Items, and affected Surfaces. A `Release` is the provider-observed
event that publishes one or more Component Versions. Fixed, linked, or independent versioning is a
durable policy over Components, not a reason to collapse those Components into one.

### Data ownership

| Record | Authority | Atlas treatment |
| --- | --- | --- |
| Component and Surface declaration | Markdown/git | Curated Atlas source |
| Package manifest and exports | Repository | Sync/validation evidence |
| Changeset source | Repository and git history | Extracted observed record |
| PR and commit | GitHub | Fetched or cached record |
| Component Version | Package registry/release provider | Persisted observed record |
| Release and version policy | Release provider/repository configuration | Observed event plus reconciled policy |
| Explicit Atlas binding in PR/Changeset | Author assertion | Confirmed relationship |
| LLM-proposed binding | Atlas inference | Relationship with provenance and confidence |

Plan 116 introduces a Neon PostgreSQL projection through Ontahi before this plan adds Changesets.
The database stores normalized observed history, reconciliation state, and Atlas-owned inferences;
it does not replace GitHub, repository history, or the registry as authority.

### Explicit and inferred bindings

PRs or Changesets may carry explicit intent:

```txt
Atlas-Shapes: bookops.model.paragraph
Atlas-Implements: bookops.internationalization-and-translations
```

Deterministic extraction should resolve package names, changed paths, Changeset membership, PRs,
commits, and published versions first. An LLM may then propose semantic bindings, always recording
its evidence and confidence separately from author assertions.

A Changeset's package frontmatter maps deterministically to declared Components through their
package names and records the requested `patch`, `minor`, or `major` impact. Its containing PR is
resolved from repository history. Authors should not repeat those mechanical links. Explicit Atlas
directives may add Plan or Item intent; important Surface impact may be declared when path/export
evidence is insufficient, with inferred suggestions remaining visibly distinct.

### GitHub App ingress

```txt
GitHub pull_request.closed
  -> verify X-Hub-Signature-256
  -> accept only merged pull requests from configured sources
  -> normalize source-control.pull-request.merged
  -> dispatch a server-only Ontahi operation
  -> reconcile authoritative source and PR observations
  -> commit PullRequest, EvidenceBinding, delivery id, and Projection Revision atomically
  -> invalidate only the derived presentation cache
```

The webhook is a reconciliation signal, not the evidence authority. GitHub remains authoritative
for PR content and merge metadata. PostgreSQL durably deduplicates the delivery and retains the
observed record, provenance, and revision needed for stable navigation.

## Execution Slices

### Slice 0: GitHub App and merged PR evidence

1. Register an Atlas GitHub App with pull-request metadata read access and
   `pull_request` webhook subscription.
2. Reuse Ontahi graph HTTP ingress for signature verification, event normalization, routing, and
   operation dispatch.
3. Read merged PRs from configured GitHub repositories using installation tokens.
4. Parse `Atlas-Implements` and `Atlas-Shapes` assertions into explicit Evidence Bindings.
5. Hydrate `PullRequest` and `EvidenceBinding` entities in the in-memory Atlas application.
6. Render linked PRs as implementation evidence attached to Item and Plan detail.
7. Keep the existing cron as a temporary recovery path until production webhook delivery is
   verified.

### Gate 1: Durable Ontahi application (completed)

[Plan 116](../done/116-atlas-ontahi-postgres-persistence.md) established the durable foundation for
Changeset and release history:

1. persist the normalized Ontahi application in Neon PostgreSQL;
2. reconcile curated Markdown and observed GitHub records with source provenance;
3. serve page, Runtime Protocol, and webhook operations through the same storage composition;
4. prove idempotent backfill and durable webhook delivery handling.

### Slice 1: Changesets and declared implementation structure

1. Materialize the decided distinction between Implementation Component, Implementation Surface,
   Component Version, Release, and versioning policy.
2. Declare `@ontahi/core` and `@ontahi/runtime-nextjs` as the first Components plus their important
   public Surfaces.
3. Read package manifests and exports for declared Components and report drift.
4. Extract Changeset metadata before release aggregation removes source files.
5. Link PR, merge commit, changed Component/Surface, Changeset, and explicit Atlas references.

### Slice 2: Release projection

1. Observe published package versions and releases.
2. Resolve which Changesets and PRs were included in each version.
3. Render `Plan/Item -> first version / later versions` and
   `Version/Release -> Changesets / PRs / Plans / Items / Surfaces`.
4. Show uncertainty when a historical relationship cannot be reconstructed exactly.

### Slice 3: Semantic inference and wider evidence

1. Let an LLM propose missing Item/Plan bindings from PR text, diff, Components, and Surfaces.
2. Add coverage, Storybook, preview, and deployment evidence behind the same provenance model.
3. Provide review/confirmation operations before inferred bindings become curated knowledge.

## Verification

- [ ] At least two durable Components and their important Surfaces are declared in Markdown.
- [ ] Atlas detects drift between a declaration and repository/package structure.
- [x] Plan 116 provides one durable Ontahi/PostgreSQL composition for reads, operations, and ingress.
- [x] No per-PR or per-commit Markdown mirror is required.
- [x] A signed GitHub App webhook dispatches a normalized merged-PR event through Ontahi ingress.
- [x] `Atlas-Implements` and `Atlas-Shapes` create explicit, provenance-bearing bindings.
- [x] Linked PRs are visible and navigable from both Plans and Atlas Items.
- [ ] A merged PR can be linked to its Changeset, merge commit, changed Component, and Atlas intent.
- [ ] A published version can list its included Changesets, PRs, Plans, Items, and Surfaces.
- [ ] A Plan or Atlas Item can show the first known released version that materialized it.
- [ ] Explicit, deterministic, and inferred relationships remain distinguishable by provenance.
- [x] Duplicate rebuilds or webhook deliveries do not duplicate evidence.
- [x] A merge does not implicitly mutate curated Plan or Item status.

## Decisions

1. Developers declare durable Components and important Surfaces in Markdown.
2. Atlas synchronizes those declarations with repository evidence instead of generating the entire
   conceptual model from the filesystem.
3. GitHub, Changesets, registries, and deployment providers remain authoritative for observed data.
4. Observed implementation history is indexed or cached outside Markdown.
5. Changesets are the semantic bridge between a PR's implementation diff and a package release.
6. Package versions and releases must be navigable in both directions with Plans and Atlas Items.
7. Merged evidence does not automatically change curated status.
8. Deterministic extraction precedes LLM inference.
9. Implementation follows the Atlas-to-Ontahi evaluation and migration in Plan 111.
10. Build the GitHub App and merged-PR evidence slice before Changesets, releases, or persistence.
11. Keep the cron refresh temporarily as a recovery mechanism, not the primary event path.
12. Treat PRs as implementation evidence attached to a Plan or Item, not as semantic evolution
    nodes; observed evidence may be in progress or merged, but never next or later.
13. A Component owns version identity; a Surface is changed within a Component Version and is not
    independently versioned by default.
14. `ComponentVersion` is a first-class observed entity. `Release` aggregates one or more Component
    Versions.
15. Fixed, linked, and independent package groups are versioning policies over Components, not
    Components themselves.
16. Complete Plan 116's Ontahi/PostgreSQL persistence boundary before Changeset ingestion.

## Open Questions

1. How long should Atlas retain deleted Changeset source after a release: indefinitely as extracted
   provenance, or reconstruct it from git history on demand?
2. Should release observation use GitHub releases, npm registry metadata, Changesets' release PR,
   or a provider-neutral combination?
3. Which Component and Surface declarations deserve explicit Markdown files versus nested metadata?
4. Should a fixed or linked group receive a navigable Release Group projection, or remain policy
   metadata on its Components until the UI needs it?
5. What confirmation promotes an inferred binding into curated Atlas knowledge?

## Closure / Evolution

Originally proposed as a manual, read-only evidence surface. Reshaped on 2026-08-31 around explicit
Implementation Component and Surface declarations, Changesets as semantic release metadata, and
bidirectional Plan/Item/version navigation. Promoted to next on 2026-09-01 after Plan 111 proved the
Ontahi application and Runtime Protocol boundary that can host curated plus observed data. Pulled to
current on 2026-09-01 and reordered around a real Atlas GitHub App plus merged-PR evidence as the
first slice. Persistence was initially deferred until the observed model earned it; production PR
evidence and the retention needs of Changesets later promoted that work ahead of release ingestion
as Plan 116.

### 2026-09-01 — merged PR evidence checkpoint

The first slice now provides:

1. GitHub App JWT and installation-token repository reads with a local token fallback;
2. signed `pull_request.closed` ingestion normalized as
   `source-control.pull-request.merged` through Ontahi graph HTTP ingress;
3. repository-tag invalidation that keeps the webhook fast and GitHub authoritative;
4. deterministic `PullRequest` and `EvidenceBinding` entities for `Atlas-Implements` and
   `Atlas-Shapes` assertions;
5. linked PR evidence regions in Plan and Item detail views;
6. a local end-to-end signed delivery check returning `202`, plus unit, integration, UI, type, and
   production-build verification.

At this checkpoint, the existing cron remained as a recovery path. Production registration,
installation on the Atlas, BookOps, and Ontahi repositories, and Vercel secret configuration were
rollout steps after this PR deployed. Changeset and release correlation was the next implementation
slice; Convex or another persistent evidence index remained deliberately deferred.

### 2026-09-02 — production source-tracing correction

Production rollout proved the signed webhook path with a redelivered
`pull_request.closed` response of `202`, but also exposed a serverless packaging gap. The initial
static build could read Atlas-owned Markdown from the checkout, while a later incremental page
regeneration ran from a traced function that omitted `plans/` and `atlas/items/`. Atlas therefore
lost its intrinsic node and Plans while the GitHub-backed BookOps and Ontahi sources remained.

The correction makes intrinsic source availability an explicit deployment invariant: the page and
Runtime Protocol server traces include every Atlas-owned Markdown file, and the production build
fails if either trace omits one. GitHub App repository selection was not the cause; the installation
already covered all repositories.

### 2026-09-02 — PR actor presentation checkpoint

PR evidence is now rendered in a dedicated implementation region attached to the target, outside
the Past / Now / Next / Later semantic evolution columns. The compact row foregrounds the PR title,
number, and relative merge age; repository and assertion kind remain available to the model but do
not consume presentation space. Author and merger are observed separately, deduplicated when they
are the same account, and rendered as a stacked group with hover role details. Open PR observation
can later add an in-progress evidence group, but PRs do not become future evolution nodes.

### 2026-09-02 — full-detail section links

Full-detail sections are now deep-linkable through `full=<node-id>` plus an optional
`section=overview|evolution|context|source`. The section controls are real links, ordinary
navigation updates browser history, and direct loads or Back / Forward restore the addressed node
and section. Overview remains the canonical default and omits the section parameter.

The same modal now provides structural navigation without closing or reopening its shell. A direct
parent appears centered above the title, and direct `contains` children appear in a subtle,
horizontally scrollable rail below the active section. These slots are real links and replace the
modal's node on ordinary navigation; shaping, support, and related evidence stays in its semantic
section rather than being mislabeled as a child. The rail replaces the conventional `Child Items`
list in Overview when both would project the same direct children.

### 2026-09-02 — map scanability and shared Runtime Protocol adapter

A focused maintenance slice improves the Atlas navigation surface and removes a temporary server
adapter seam:

1. collapsed map branches expose direct-child and total-descendant counts;
2. persistent search chrome gives way to a `Command-K` / `Control-K` palette with an opaque focus
   surface, source badges, and visually prominent Plan numbers;
3. Atlas consumes `@ontahi/core` and `@ontahi/runtime-nextjs` at exact `1.0.0-alpha.10` versions;
4. `POST /runtime` delegates HTTP parsing, status mapping, and response serialization to the shared
   Next.js Runtime Protocol adapter while retaining Atlas's dispatcher, handlers, and trusted
   context derivation.

Legacy family-specific Fetch clients remain unchanged; their migration belongs to the separate
Ontahi-owned client cutover.

### 2026-09-02 — repository authoring convention

Atlas now owns a canonical, copyable guideline for PR and commit evidence assertions. The contract
defines `Atlas-Implements` versus `Atlas-Shapes`, stable target forms, supported list syntax,
authoring and verification workflow, and the important current limitation that Atlas ingests the
merged PR body rather than commit trailers. Atlas, BookOps, and Ontahi point their agent
instructions at identical repository-local copies so the convention is present where PRs are
prepared.

### 2026-09-02 — branded loading boundary and refresh diagnosis

Atlas now exposes server-side source assembly through a full-canvas loading boundary instead of
leaving a slow refresh visually inert. A standalone, theme-aware Atlas mark is shared by the splash
and compact canvas chrome; the product name and language remain accessible HTML rather than being
baked into the artwork.

The refresh delay is not simply an absent upstream cache. Remote repository and PR reads retain
their bounded Next.js cache, while a page render still reloads local Markdown and rebuilds the
in-memory application, compatibility snapshot, topology, and evidence projection. This checkpoint
adds feedback, not a hidden persistence layer. Plan 116 now owns materializing that assembled
projection with explicit reconciliation and invalidation before Changeset ingestion.

### 2026-09-02 — persistence and version model checkpoint

The next evidence slice now depends on
[116. Atlas Ontahi PostgreSQL Persistence](../done/116-atlas-ontahi-postgres-persistence.md). Merged
PR evidence proved the observed model, while upcoming Changesets proved the need to retain records
that are later consumed by release aggregation. Atlas will therefore establish a durable Ontahi
application on Neon PostgreSQL before extracting Changesets or package versions.

The release model is also narrowed:

1. an Implementation Component has durable identity and version history;
2. an Implementation Surface belongs to a Component and may change within a version, but is not
   independently versioned by default;
3. `ComponentVersion` is a first-class observed entity;
4. a `Release` publishes one or more Component Versions;
5. fixed, linked, and independent package groups describe versioning policy rather than introducing
   synthetic Components;
6. Plans may declare intended Component/Surface impact and Atlas Items may declare what realizes
   them, while the released version relationship is derived through PR and Changeset evidence.

Ontahi is the first pilot. `@ontahi/core` and `@ontahi/runtime-nextjs` provide real Components,
public Surfaces, package manifests, a fixed Changesets group, and published versions against which
the model can be verified. BookOps can adopt the same declarations later without blocking the
first release-evidence slice.

### 2026-09-03 — persistence gate completed

Plan 116 completed the Neon-backed Ontahi composition for page reads, Runtime Protocol operations,
source reconciliation, and durable GitHub ingress. Plan 102 may now proceed with Changesets,
Component Versions, and Releases on that shared persistence boundary.
