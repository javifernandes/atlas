# 102. Atlas Implementation And Release Evidence

Status: current

Depends on: [111. Atlas As An Ontahi Application](../done/111-atlas-as-ontahi-application.md)

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

Atlas does not yet own a GitHub App or webhook receiver. Hosted data currently becomes fresh through
five-minute Next.js revalidation plus a six-hour GitHub Actions cron that calls a Vercel deploy hook.
That polling path proves the federated read model, but it cannot provide a direct, authenticated
merge signal and was incorrectly described in earlier plans as an existing GitHub App.

BookOps already proves the intended Ontahi-native shape: a GitHub webhook provider verifies and
normalizes a delivery, the generic graph HTTP ingress router selects a declared channel, and a
server-only Ontahi operation performs the application work. Atlas can reuse that architecture while
keeping GitHub authoritative and avoiding a Markdown event mirror.

This capability follows [Plan 111](../done/111-atlas-as-ontahi-application.md). Ontahi now gives
Atlas a model and operation layer in which curated declarations and observed evidence can coexist
without pretending they have the same authority or storage lifecycle.

## Research / Evidence

1. BookOps and Ontahi already use Changesets to describe versioned package changes.
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
8. `@ontahi/core@1.0.0-alpha.9`, already consumed by Atlas, exposes graph HTTP ingress routing and
   operation dispatch. BookOps exercises the same boundary for signed GitHub App webhooks.

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
6. Do not introduce persistence before the observed evidence slice establishes its retention and
   query requirements.
7. Do not mutate Plan or Item status from a merged PR.
8. Do not implement Changeset, release, or database ingestion in the first merged-PR slice.

## Proposed Form

### Curated component declarations

A developer declares a durable implementation boundary in Markdown:

```yaml
---
id: bookops.implementation.model-package
kind: implementation-component
title: BookOps Model Package
componentType: package
repository: javifernandes/bookops
path: model
package: "@bookops/model"
realizes:
  - bookops.model
surfaces:
  - bookops.implementation.model-content-surface
---
```

An important consumer boundary can be declared separately:

```yaml
---
id: bookops.implementation.model-content-surface
kind: implementation-surface
title: BookOps Content Model Surface
component: bookops.implementation.model-package
locator: "@bookops/model/content"
realizes:
  - bookops.model.book
  - bookops.model.paragraph
---
```

The exact frontmatter keys remain a design output of this plan. The important distinction is that a
Component is a durable unit with identity, while a Surface is a boundary it exposes to consumers.

### Observed evidence model

```txt
Plan / Atlas Item
  <- shapes / implements / evidences - PR
  <- described by -------------------- Changeset
  <- materialized in ----------------- Package Version

PR
  -> changes ------ Implementation Component / Surface
  -> contains ----- Changeset
  -> merged as ---- Commit

Release
  -> publishes ---- Package Version / Artifact
  -> includes ----- Changeset
  -> advances ----- Plan / Atlas Item
```

`@bookops/model` is an Implementation Component. `@bookops/model/content` is a Surface.
`@bookops/model@1.8.0` is a versioned Artifact or Package Version. These are related but not
interchangeable concepts.

### Data ownership

| Record | Authority | Atlas treatment |
| --- | --- | --- |
| Component and Surface declaration | Markdown/git | Curated Atlas source |
| Package manifest and exports | Repository | Sync/validation evidence |
| Changeset source | Repository and git history | Extracted observed record |
| PR and commit | GitHub | Fetched or cached record |
| Published version | Package registry/release provider | Fetched or cached record |
| Explicit Atlas binding in PR/Changeset | Author assertion | Confirmed relationship |
| LLM-proposed binding | Atlas inference | Relationship with provenance and confidence |

The database, if adopted, stores an index/cache and Atlas-owned inferences. It does not replace
GitHub or the registry as authority.

### Explicit and inferred bindings

PRs or Changesets may carry explicit intent:

```txt
Atlas-Shapes: bookops.model.paragraph
Atlas-Implements: bookops.internationalization-and-translations
```

Deterministic extraction should resolve package names, changed paths, Changeset membership, PRs,
commits, and published versions first. An LLM may then propose semantic bindings, always recording
its evidence and confidence separately from author assertions.

### GitHub App ingress

```txt
GitHub pull_request.closed
  -> verify X-Hub-Signature-256
  -> accept only merged pull requests from configured sources
  -> normalize source-control.pull-request.merged
  -> dispatch a server-only Ontahi operation
  -> invalidate repository evidence/source caches
  -> rebuild the in-memory PullRequest and EvidenceBinding projection on the next read
```

The webhook is an invalidation signal, not the durable evidence store. GitHub remains authoritative
for PR content and merge metadata. Duplicate delivery is therefore harmless in the first slice;
persistent delivery-id deduplication belongs with the later evidence index.

## Execution Slices

### Slice 0: GitHub App and merged PR evidence

1. Register an Atlas GitHub App with pull-request metadata read access and
   `pull_request` webhook subscription.
2. Reuse Ontahi graph HTTP ingress for signature verification, event normalization, routing, and
   operation dispatch.
3. Read merged PRs from configured GitHub repositories using installation tokens.
4. Parse `Atlas-Implements` and `Atlas-Shapes` assertions into explicit Evidence Bindings.
5. Hydrate `PullRequest` and `EvidenceBinding` entities in the in-memory Atlas application.
6. Render linked PRs in Item and Plan evolution views.
7. Keep the existing cron as a temporary recovery path until production webhook delivery is
   verified.

### Slice 1: Changesets and declared implementation structure

1. Finalize the distinction between System, Implementation Component, Implementation Surface,
   Artifact, Package Version, and Release.
2. Declare two real Components and their important Surfaces.
3. Read package manifests and exports for declared Components and report drift.
4. Extract Changeset metadata before release aggregation removes source files.
5. Link PR, merge commit, changed Component/Surface, Changeset, and explicit Atlas references.

### Slice 2: Release projection

1. Observe published package versions and releases.
2. Resolve which Changesets and PRs were included in each version.
3. Render `Plan/Item -> first version / later versions` and
   `Version/Release -> Changesets / PRs / Plans / Items / Surfaces`.
4. Show uncertainty when a historical relationship cannot be reconstructed exactly.

### Slice 3: Persistent evidence index

1. Introduce a storage adapter behind the Ontahi application boundary.
2. Persist observed evidence needed for historical navigation and webhook delivery deduplication.
3. Keep GitHub, registries, and repositories authoritative; persistence is an index plus
   Atlas-owned provenance.
4. Evaluate Convex locally before configuring its production deployment and Vercel integration.

### Slice 4: Semantic inference and wider evidence

1. Let an LLM propose missing Item/Plan bindings from PR text, diff, Components, and Surfaces.
2. Add coverage, Storybook, preview, and deployment evidence behind the same provenance model.
3. Provide review/confirmation operations before inferred bindings become curated knowledge.

## Verification

- [ ] At least two durable Components and their important Surfaces are declared in Markdown.
- [ ] Atlas detects drift between a declaration and repository/package structure.
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

## Open Questions

1. Should `PackageVersion` be a specialized Artifact, a value attached to a Component, or its own
   observed entity?
2. How long should Atlas retain deleted Changeset source after a release: indefinitely as extracted
   provenance, or reconstruct it from git history on demand?
3. Should release observation use GitHub releases, npm registry metadata, Changesets' release PR,
   or a provider-neutral combination?
4. Which Component and Surface declarations deserve explicit Markdown files versus nested metadata?
5. How should monorepo fixed/linked package groups appear in the release projection?
6. What confirmation promotes an inferred binding into curated Atlas knowledge?

## Closure / Evolution

Originally proposed as a manual, read-only evidence surface. Reshaped on 2026-08-31 around explicit
Implementation Component and Surface declarations, Changesets as semantic release metadata, and
bidirectional Plan/Item/version navigation. Promoted to next on 2026-09-01 after Plan 111 proved the
Ontahi application and Runtime Protocol boundary that can host curated plus observed data. Pulled to
current on 2026-09-01 and reordered around a real Atlas GitHub App plus merged-PR evidence as the
first slice. Changesets/releases follow, while persistence remains deferred until the observed model
earns it.

### 2026-09-01 — merged PR evidence checkpoint

The first slice now provides:

1. GitHub App JWT and installation-token repository reads with a local token fallback;
2. signed `pull_request.closed` ingestion normalized as
   `source-control.pull-request.merged` through Ontahi graph HTTP ingress;
3. repository-tag invalidation that keeps the webhook fast and GitHub authoritative;
4. deterministic `PullRequest` and `EvidenceBinding` entities for `Atlas-Implements` and
   `Atlas-Shapes` assertions;
5. linked PR cards in Plan and Item Evolution views;
6. a local end-to-end signed delivery check returning `202`, plus unit, integration, UI, type, and
   production-build verification.

The existing cron remains as a recovery path. Production registration, installation on the Atlas,
BookOps, and Ontahi repositories, and Vercel secret configuration are rollout steps after this PR
is deployed. Changeset and release correlation remains the next implementation slice; Convex or
another persistent evidence index remains deliberately deferred.

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
