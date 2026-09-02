# 111. Atlas As An Ontahi Application

Status: done

Definition level: shaped

## Summary

Evaluate and then migrate Workstream Atlas into a real Ontahi application, using Atlas as a second
serious product consumer of the framework.

The first slice is deliberately an evaluation rather than a wholesale rewrite. It must prove that
the existing Markdown graph can be hydrated into Ontahi entities and relations, queried through a
real Ontahi application boundary, and projected back into the current viewer without losing
behavior. If that proof succeeds, the migration continues incrementally behind the standalone
source, snapshot, and viewer seams.

This closes a productive loop:

1. Atlas gains the entity, relation, operation, runtime, reflection, and future persistence work
   already available in Ontahi.
2. Ontahi gains a new real application whose model, source ownership, graph navigation, and
   evidence requirements differ substantially from BookOps.

## Context

Atlas started as a viewer over `plans/` and `atlas/items/`. That was the right first move: it kept
the source simple, local, readable by agents, and compatible with git.

[Plan 133](bookops://plans/133-atlas-standalone-extraction) has now separated Atlas into a standalone
repository with stable source, snapshot, and viewer boundaries. The current application still
assembles one large read model directly from Markdown and passes it to the viewer. This makes the
map useful, but leaves domain behavior, generated evidence, and future write operations without an
application model underneath them.

The pressure is now broader than assisted editing. Atlas wants to represent two kinds of state:

1. curated system form owned by Markdown, including Atlas Items, Plans, Implementation Components,
   and their declared relationships;
2. observed implementation history owned by external systems, including PRs, commits, Changesets,
   package releases, deployments, and evidence bindings.

At the time this plan was written, the scheduled Vercel rebuild path was mistakenly described as an
existing Atlas GitHub App. The implemented baseline was five-minute source revalidation plus a
six-hour deploy-hook cron. Plan 102 now introduces the actual GitHub App and Ontahi HTTP ingress.
Before designing persistence and wider evidence projection, this plan first determined whether
Ontahi was the right domain and runtime foundation.

Atlas also wants operations that are difficult to keep as UI-only behavior:

1. review a plan's status against the repository,
2. link a plan or PR to the system items it shaped,
3. create a plan from an evolution signal,
4. reconcile historical plans with the current system form,
5. inspect which released package version materialized a plan or model change,
6. navigate from a release back to its Changesets, PRs, plans, and Atlas Items.

## Research / Evidence

1. [104. Atlas Source Shape v0](../done/104-atlas-source-shape-v0.md) established Markdown as the
   curated semantic source.
2. [Plan 133](bookops://plans/133-atlas-standalone-extraction) extracted the standalone application and
   preserved `source documents -> snapshot -> viewer` as an explicit seam.
3. The standalone Atlas page currently renders the result of `getPlanWorkstreamSnapshot()` directly;
   the viewer already consumes a stable projection rather than reading Markdown itself.
4. The current snapshot builder parses Atlas Items and Plans, derives containment and semantic
   relations, and returns a graph-shaped read model. This is a natural adapter boundary, but should
   not become the Ontahi domain model by copying every snapshot field into one entity.
5. Ontahi currently provides declared entities and relations, graph reads and commands, operations,
   in-memory execution, Postgres and Supabase adapters, Next.js transport, and reflected Explorer
   surfaces.
6. Ontahi's current Next.js and React peer ranges are compatible with the standalone Atlas runtime.
7. BookOps already exercises Ontahi as a large existing consumer. Atlas adds different pressure:
   federated read models, Markdown authority, temporal evidence, external-source identity, and
   projections over conceptual plus implementation graphs.
8. [102. Atlas Implementation And Release Evidence](../current/102-workstream-atlas-implementation-evidence.md)
   captures the first major capability to build after this boundary proves itself.

## Scope

1. Evaluate Ontahi against one thin but real Atlas vertical slice before committing to the full
   migration.
2. Keep Markdown and git as the authority for curated Atlas declarations.
3. Define the smallest useful Atlas domain model in Ontahi, beginning with `AtlasItem`, `Plan`, and
   their containment or shaping relations.
4. Hydrate that model from the current Markdown/source adapter into an in-memory runtime first.
5. Execute at least one real Atlas query through Ontahi and project its result into the existing
   snapshot/viewer contract.
6. Record framework friction discovered by the pilot as concrete Ontahi feedback rather than
   working around it invisibly inside Atlas.
7. If the pilot succeeds, move read-model construction behind the Ontahi application boundary in
   incremental slices.
8. Introduce one proposal-style operation only after the read path proves useful.
9. Leave a clean persistence boundary for later GitHub, Changesets, release, and evidence models.

## Non-Goals

1. Do not move curated Atlas Items or Plans out of Markdown.
2. Do not add a production database during the evaluation slice.
3. Do not ingest PRs, commits, Changesets, or releases in this plan; Plan 102 follows this migration.
4. Do not replace the current viewer or redesign its information architecture.
5. Do not translate the current snapshot type field-for-field into one decorative Ontahi entity.
6. Do not make every viewer interaction an Ontahi operation.
7. Do not force an Ontahi abstraction where the pilot shows that a pure projection is the simpler
   boundary.

## Proposed Form

The migration should preserve the current adapters while placing an Ontahi model between source
parsing and UI projection:

```txt
Markdown repositories
  -> Atlas source adapter
      -> parsed source records
          -> Ontahi Atlas application
              entities + relations + queries + operations
                  -> Atlas viewer projection
                      -> existing snapshot contract
                          -> existing Atlas UI
```

Later, observed implementation sources can enter through separate adapters:

```txt
GitHub App events + GitHub API + Changesets/package metadata
  -> observed evidence adapters
      -> Ontahi evidence/release model
          -> item, plan, component, version, and release projections
```

The important ownership rule is:

| Information | Authority | Initial runtime form |
| --- | --- | --- |
| Atlas Item and Plan declarations | Markdown/git | Parsed into an in-memory Ontahi graph |
| Implementation Component declarations | Markdown/git | Added after the core migration proves useful |
| PRs, commits, and merge state | GitHub | Fetched or cached outside Markdown |
| Changesets | Repository source plus git history | Extracted records |
| Published package versions | Package registry/release provider | Fetched or cached records |
| Inferred evidence bindings | Atlas/Ontahi | Persisted with provenance when a DB is introduced |

The first candidate model is intentionally small:

```txt
AtlasItem
  contains -> AtlasItem

Plan
  shapes -> AtlasItem
  relatedTo -> AtlasItem

SourceDocument
  declares -> AtlasItem | Plan
```

The current snapshot remains a UI projection during migration. It should not be treated as the
canonical domain schema.

## Evaluation Checkpoint — 2026-08-31

### Pilot

The evaluation added a standalone Atlas domain pilot using published `@ontahi/core@1.0.0-alpha.8`:

```txt
current Atlas snapshot
  -> transitional dataset adapter
      -> Ontahi in-memory application
          AtlasItem
          AtlasPlan
          AtlasShapingBinding
      -> GetItemContext semantic query
          parent
          children
          shaping plans
```

The pilot deliberately starts from the current snapshot. This is acceptable for comparing Ontahi's
runtime and relation model, but it is not the target migration boundary.

### Evidence

1. A multi-source fixture hydrates declared `AtlasItem`, `AtlasPlan`, and `AtlasShapingBinding`
   entities.
2. `GetItemContext` resolves a self-referential parent, inverse children, and plans through an
   explicit shaping-binding entity.
3. Missing items return no context without requiring a database or browser runtime.
4. A one-off local run over the current BookOps plus Ontahi sources loaded 248 nodes and 949 edges,
   hydrated the Ontahi application in approximately 1.7 ms, and resolved one application-boundary
   context query in approximately 2.3 ms. These figures are directional evidence from one local
   run, not a benchmark contract.
5. Atlas tests, typecheck, and production build accept the published Ontahi package and server-side
   in-memory model.
6. [Plan 147: Application-Bound Headless Graph Reads](ontahi://plans/147-application-bound-headless-graph-reads)
   landed in `@ontahi/core@1.0.0-alpha.9` from the host-read feedback discovered by this pilot.

### Findings and ownership

| Finding | Owner | Consequence |
| --- | --- | --- |
| Entities, self-relations, inverse relations, join entities, and nested projections fit the Atlas context model. | Ontahi fit confirmed | Continue to a source-record slice. |
| The current Markdown parser emits a UI snapshot directly, so the pilot must translate derived nodes and edges back into domain records. | Atlas | Extract normalized source records before production migration. |
| Source-owned `relatedPlans` values are not consistently canonicalized from relative paths to source URIs before snapshot assembly. | Atlas | Fix normalization at the source-record boundary; otherwise shaping relations disappear before Ontahi sees them. |
| Application-graph reads outside an entity operation required an explicit `runServerEffect` plus data-graph runtime concern. | Resolved in Ontahi alpha.9 | `application.graph.read(...)` now pins the exact application runtime and owns the host Promise boundary. |
| Query terminals such as `.one()` did not compose directly with the low-level in-memory executor used by the pilot. | Resolved in Ontahi alpha.9 | The application-bound read API interprets `first`, `one`, `count`, and `exists`; Atlas uses `first` where absence is valid. |
| Typed recursive semantic refs carry field contracts but make cyclic relation typing/order more awkward than acyclic declarations. | Ontahi API ergonomics | Keep the first Atlas graph acyclic around the shaping join and evaluate a framework improvement separately. |
| Installing core also brings Effect, Typia, and Zod runtime/tooling dependencies. | Shared | Accept for the pilot; measure build/bundle impact before adding browser/runtime packages. |
| The common Runtime Protocol dispatcher has an Express projection, but `@ontahi/runtime-nextjs@1.0.0-alpha.9` does not yet expose a matching route adapter. | Ontahi adapter ergonomics | Atlas owns a narrow Next route for now; promote it to Ontahi if the next release wants transport parity. |

### Decision

**Continue, with a revised boundary.** Ontahi owns real relationship materialization and query
behavior in the pilot, and its in-memory runtime is fast enough for Atlas's current build-sized
graph. The current snapshot-to-dataset adapter is not clear enough to become production
architecture, so the viewer should not be rewired yet.

The next slice must first introduce normalized source records:

```txt
Markdown -> normalized Atlas source records -> Ontahi dataset/application -> viewer snapshot
```

The migration should stop or be revised again if that pipeline duplicates most snapshot logic or
if parity requires leaking viewer-only fields into the Ontahi entities.

## Slice 1 Checkpoint — Source Identity Canonicalization

Atlas now normalizes every loaded Markdown file into an explicit source record before parsing:

```txt
AtlasMarkdownFile
  -> NormalizedAtlasSourceRecord
      sourceId
      sourcePath
      canonicalPath
      sourceFilePath
```

Plan references in Atlas Item frontmatter follow the same identity rule as the plan records they
target. A repository-local value such as `plans/done/111-atlas-as-ontahi-application.md` from
the intrinsic `atlas` source becomes `atlas://plans/111-atlas-as-ontahi-application`; an explicit
value such as `ontahi://plans/...` remains cross-source and unchanged. Markdown does not need a
bulk rewrite.

The regression fixture covers both forms in one item. A local run against intrinsic Atlas plus the
configured BookOps and Ontahi sources also confirmed that Plan 111 now materializes a `shaped-by`
edge from the source-local `relatedPlans` declarations that previously disappeared during snapshot
assembly.

This closes the source-identity defect found by Slice 0. The next migration step is still to hydrate
the Ontahi application from these normalized records rather than from the derived viewer snapshot.

### Ownership checkpoint

Atlas now loads repository-local `plans/` and `atlas/items/` as its intrinsic `atlas` source. The
active and future Atlas plans, the Workstream Atlas item tree, and the source-shape contract moved
from BookOps into this standalone repository on 2026-08-31. BookOps remains a federated source for
its product model and historical interventions, including Plan 133.

This makes the next Ontahi slice repository-local: both the application code and the curated Atlas
domain declarations now share one owner. Cross-project relationships use `bookops://...` and
`ontahi://...` references rather than copies.

## Slice 1b Checkpoint — Ontahi alpha.9 Runtime Boundary

Atlas now uses `@ontahi/core@1.0.0-alpha.9` and executes its headless item-context query through the
application-bound API:

```txt
snapshot-backed pilot dataset -> in-memory Atlas application -> application.graph.read(...) -> projection
```

This removes the pilot's manual `runServerEffect` and runtime-concern assembly. The item lookup uses
the semantic `first()` terminal because a missing Atlas Item is a valid `null` result; `one()` is
now available for reads whose contract requires exact cardinality.

At this checkpoint the execution boundary changed while hydration still came from the compatibility
snapshot. Slice 1c below moves that hydration upstream to normalized source records.

The [Ontahi Runtime Protocol](ontahi://plans/146-ontahi-runtime-protocol) is the next distributed
boundary, not an extra hop inside the static build. Atlas should project it when execution crosses
a process or transport boundary:

```txt
browser / GitHub worker / external agent
  -> Ontahi Runtime Protocol
      -> Atlas application authority
          -> graph reads, commands, operations, or durable observation
```

Until one of those callers exists, source parsing, in-memory hydration, and build-time projection
remain direct application calls. This keeps protocol semantics available without turning HTTP into
the domain boundary prematurely.

## Slice 1c Checkpoint — Direct Source-Record Hydration

The Atlas application facade now accepts `NormalizedAtlasSourceRecord[]` rather than a
`PlanWorkstreamSnapshot`. One shared semantic parser produces Plan and Atlas Item records for both
the compatibility snapshot and the Ontahi dataset:

```txt
Markdown files
  -> normalized source records
      -> parsed Plan and Atlas Item records
          -> Ontahi dataset/application
          -> compatibility viewer snapshot
```

The Ontahi dataset materializes containment and shaping bindings directly from declarations. It no
longer reconstructs domain state from viewer nodes and edges, so presentation rules—such as hiding
an ancestor's redundant `shaped-by` edge—cannot erase a declared relationship before a domain query
sees it.

The existing viewer remains snapshot-backed. The next read-projection slice should consume the
application-bound item-context query from a real Atlas surface, then compare it against the current
client projection before removing any direct assembly path.

## Slice 2 Checkpoint — Selection Context Projection

The static page build now loads source files once, hydrates the Atlas application from normalized
records, and obtains a serializable item-context index through `application.graph.read(...)`.

The selection panel uses that Ontahi projection for:

1. the selected item's parent,
2. its direct children,
3. its declared shaping Plans.

The full-detail context and Evolution tabs use the same relation projection for Atlas Items.
Supports, related links, semantic signals, temporal grouping, Plan evolution, and the global map
remain compatibility or presentation concerns. This creates a narrow parity seam instead of
replacing the entire viewer at once. Viewer regressions prove a shaping Plan supplied only by the
Ontahi context appears in both the selection panel and Evolution even when the compatibility edge
is absent.

No Runtime Protocol request is needed yet: these reads execute during the server-side static build
and cross into the browser as ordinary serialized projection data. A live refresh, proposal
operation, webhook worker, or external agent call will be the first justified protocol boundary.

The global map and board remain on the compatibility snapshot deliberately. Their complete graph
projection still includes supports, related Plan links, status metrics, documents, and presentation
nodes that are not in the current Ontahi domain model. Rebuilding that same aggregate through graph
queries would add transport and adapter work without owning more domain behavior.

## Slice 2b Checkpoint — Application-Owned Topology

Ontahi now owns the complete relation topology consumed by every Atlas surface. The domain adds
`AtlasSupportBinding` for directional Item support, `AtlasPlanRelationBinding` for Plan
`related/follow-up` links, and Plan parent/children relations alongside the existing containment and
shaping bindings.

The static build queries those entity sets through `application.graph.read(...)` and projects one
edge collection for the map, board, selection panel, Context tab, and Evolution tab:

```txt
normalized source records -> Ontahi entities and relations -> application graph reads
                                                     -> topology projection -> all viewer surfaces
```

The projection keeps current product rules explicit: unresolved relationships are omitted,
containment-relative support links are hidden as redundant, ancestor shaping links yield to the
same declaration on a descendant, and only Plans reached from curated Item bindings enter the
visible topology. The declared bindings remain present in the Ontahi dataset even when a
presentation rule hides an edge.

The compatibility snapshot still owns node cards, Markdown documents, metrics, semantic signals,
status grouping, and layout inputs. It no longer owns the relation collection shown by the UI. This
removes the per-selected-item merge path and gives every surface one application-owned topology
without forcing presentation metadata into domain entities.

## Slice 3 Checkpoint — Reviewable Plan-Link Proposal

`AtlasItem.proposePlanLink` is the first Atlas domain operation. Its input uses existing Ontahi refs
for both the Atlas Item and Plan, so invocation validates identity and presence before the source
adapter runs. The application-owned proposal capability then returns a JSON-safe result containing:

1. the owning source and repository-relative target path,
2. the canonical Plan identity and authoring reference,
3. `proposed` or idempotent `already-linked` status,
4. a unified Markdown diff.

Same-source links are authored as ordinary repository paths; cross-source links retain their
canonical URI. The operation never changes the source record or filesystem and its public result
does not return the complete Markdown document.

Atlas now exposes the operation family at `POST /runtime` through the Ontahi Runtime Protocol. This
is the first real distributed boundary in the migration: a browser or external agent can send a
versioned, correlated operation request while the receiving Atlas runtime owns source loading,
operation resolution, input hydration, and execution. The process caches its hydrated application
and discards that cache after a load failure. Because alpha.9 does not yet provide a common Runtime
Protocol route in `@ontahi/runtime-nextjs`, Atlas supplies the small HTTP/status adapter locally;
the envelope, family parsing, dispatch, and operation response remain Core-owned.

A focused protocol test covers operation dispatch and a production HTTP smoke test returned an
`already-linked` result for the real Semantic Source Item and Plan 111. Applying a proposal remains
a separate future operation: it must add authentication, a repository/file effect, provenance, and
human review rather than turning this read-only endpoint into an implicit write path.

## Execution Slices

### Slice 0: Ontahi fit evaluation

1. [x] Map the minimum current parser output needed for `AtlasItem`, `Plan`, containment, and one shaping
   relation.
2. [x] Declare that model with the current released Ontahi packages inside the standalone Atlas
   repository.
3. [x] Hydrate a representative multi-repository fixture into Ontahi's in-memory runtime.
4. [x] Execute one real query, such as selected item plus parent, children, and shaping plans.
5. [x] Project the query result into the existing snapshot or a compatible detail-view input.
6. [x] Compare behavior, complexity, build-time compatibility, and performance with the current pure
   builder.
7. [x] Record every missing or awkward Ontahi capability and decide whether it belongs in Ontahi,
   Atlas, or the adapter.

Decision gate: continue only if Ontahi owns real model/query behavior and the adapter is clearer
than the equivalent direct snapshot construction. If the pilot merely wraps existing arrays, revise
the model or stop before broad migration.

### Slice 1: Application and source boundary

1. [x] Introduce the Atlas Ontahi application facade and domain declarations at the normalized
   source-record boundary rather than the transitional snapshot boundary.
2. [x] Keep parsing pure and make Markdown normalization an explicit source adapter.
3. [x] Preserve stable source identity across repositories and canonical Atlas references.
4. [x] Make the evaluated domain/query layer usable without React or a browser.

### Slice 2: Read projection migration

1. [x] Move selected-item structure and shaping context behind Ontahi first.
2. [x] Move the selected item's evolution reads behind Ontahi.
3. [x] Evaluate the map/board projection and retain the compatibility snapshot until the Ontahi
   model owns more than its current aggregate.
4. [x] Keep parity tests at the viewer projection boundary.
5. [x] Remove the direct viewer-edge assembly paths after equivalent behavior is proven.

### Slice 3: First proposal operation

1. [x] Choose `AtlasItem.proposePlanLink` as the first proposal operation.
2. [x] Return a reviewable Markdown patch rather than mutating the repository directly.
3. [x] Exercise Ontahi operation contracts and the Runtime Protocol in a real Atlas workflow.
4. [x] Defer authenticated apply and provenance to the reviewed command boundary in
   [Plan 103](../backlog/103-workstream-atlas-assisted-editing.md); proposal generation is the
   completed migration slice here.

### Slice 4: Framework feedback and next capability

1. Promote generally useful friction into focused Ontahi issues/plans and package changes.
2. Keep Atlas-specific projection behavior local to Atlas.
3. Re-evaluate persistence after the model has both curated and observed data requirements.
4. Pull [Plan 102](../current/102-workstream-atlas-implementation-evidence.md) when the boundary can
   host Components, Surfaces, Changesets, releases, and evidence without Markdown duplication.

## Verification

- [x] A written fit evaluation records the compared current and Ontahi-backed paths.
- [x] A representative multi-source Atlas dataset hydrates into an in-memory Ontahi runtime.
- [x] At least one item-context query uses declared Ontahi entities and relations.
- [x] The resulting context projection preserves the current data needed for that slice.
- [x] Atlas still reads the existing `plans/` and `atlas/items/` source files.
- [x] No production database or GitHub-data duplication is required for the pilot.
- [x] Framework gaps discovered by Atlas have explicit ownership and follow-up direction.
- [x] The migration has a `continue with revised boundary` decision before broad replacement.
- [x] The evaluated Atlas domain module is usable without a browser.
- [x] Source-local `relatedPlans` values resolve to their source-owned canonical Plan identity while
  explicit cross-source URIs remain stable.
- [x] The real Atlas selection panel consumes application-bound structure and shaping reads, with
  viewer parity covered by the full test, typecheck, and production-build verification.
- [x] Map, board, selection, Context, and Evolution consume one Ontahi-backed topology containing
  Item containment/support/shaping and Plan containment/related/follow-up relations.
- [x] At least one proposal operation can produce a reviewable Markdown change without applying it.

## Decisions

1. Evaluate the Ontahi migration before building the GitHub/Changesets evidence model.
2. Use Atlas as an Ontahi dogfooding application and treat framework feedback as a first-class
   outcome.
3. Keep Markdown authoritative for curated semantic declarations.
4. Start with Ontahi's in-memory runtime; persistence must be earned by observed evidence needs.
5. Preserve the current snapshot as a compatibility projection for node and document presentation
   while Ontahi takes ownership of graph relations.
6. Require a real query/relationship benefit; wrapping the existing snapshot is not sufficient.
7. Separate curated source adapters from observed evidence adapters.
8. Sequence Plan 102 after the Ontahi boundary is proven.

## Open Questions

1. Should `Plan` be a distinct Ontahi entity or an Atlas Item type expressed through one entity and
   a discriminated field?
2. Should containment and semantic relations share one `AtlasRelation` model or use declared Ontahi
   relations per meaning?
3. Can the in-memory runtime hydrate the full federated graph efficiently during a static build, or
   should Atlas produce a serialized Ontahi dataset first?
4. Which current derived fields belong in domain queries and which should remain viewer projection
   concerns?
5. Does the first proposal operation expose gaps in Ontahi's file/patch effect boundaries?
6. When observed GitHub data arrives, should persistence live in an Atlas-owned Postgres database,
   a rebuild cache, or a replaceable evidence store?

## Child Plans

1. [112. Ontahi Capability Package Composition v0](bookops://plans/112-ontahi-capability-package-composition-v0)

## Closure / Evolution

Closed on 2026-09-01. The evaluation gate succeeded and the migration landed incrementally:
normalized source records hydrate an Ontahi application, application-bound graph reads own the
topology used by every viewer surface, and `AtlasItem.proposePlanLink` is available through the
Runtime Protocol as a reviewable read-only operation.

Authenticated apply and provenance are intentionally deferred to
[Plan 103](../backlog/103-workstream-atlas-assisted-editing.md). GitHub, Changesets,
package-version, persistence, and release evidence continue in
[Plan 102](../current/102-workstream-atlas-implementation-evidence.md). Those are new capabilities,
not incomplete migration slices.
