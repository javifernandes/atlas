# 136. Atlas Adoption Foundation

Status: current

## Summary

Prepare Atlas for adoption by people and projects beyond its original repositories without turning
that goal into a broad platform rewrite. Start by reducing the change risk concentrated in the
largest source modules, bring Atlas onto the current coherent Ontahí release line, and then use those
clearer boundaries to introduce workspace-scoped collaboration and dynamically registered sources.

Evaluate incremental reconciliation separately from the collaboration work. Implement it only when
the measured source, database, and provider costs justify the additional consistency model.

## Context

Atlas already federates repository-owned Plans and Atlas Items, persists a revisioned projection,
observes GitHub evidence, authenticates durable Users, and exposes Ontahí operations and Runtime
Protocol routes. Those foundations are sufficient for a focused multi-repository viewer, but several
implementation and product boundaries still assume one deployment, one configured source registry,
and a small group of closely coordinated contributors.

The most immediate development risk is concentrated code:

| Module | Approximate lines | Current responsibility pressure |
| --- | ---: | --- |
| `src/atlas/viewer/atlas-explorer.tsx` | 6,243 | map, board, search, selection, detail, Markdown rendering, inferred links, interactions |
| `src/atlas/domain/atlas-application.ts` | 2,003 | entities, relations, reads, operations, projection construction |
| `src/atlas/markdown/build-snapshot.ts` | 1,371 | parsing, identity, topology, inference, documents, compatibility projection |
| `src/atlas/viewer/execution-stream-view.tsx` | 1,366 | session navigation, selection, forking, lifecycle operations, presentation |
| `src/atlas/persistence/postgres-application.ts` | 1,015 | mapping, reconciliation, snapshots, evidence, sessions, recovery |

Line count alone is not the defect. The pressure is that independently changing concerns share
files, private helpers, tests, and state transitions, making ownership and safe parallel work more
expensive.

Atlas currently pins `@ontahi/core`, `@ontahi/postgres`, `@ontahi/react`, and
`@ontahi/runtime-nextjs` to `1.0.0-alpha.12`. Ontahí `1.0.0-alpha.15` is the latest published release
in the verified upstream repository. The intervening release line adds canonical model-supported
applications, parameterized Reads and Commands, one application Runtime Protocol receiver,
mutation-driven observation refresh, durable Interactions and Events, provider-neutral
model-backed Domain Operation execution, typed Graph Read policies, and published OpenAI and
Anthropic model providers. Atlas can upgrade its current runtime packages without selecting a model
provider or adding an LLM-facing product feature.

The adoption boundary after that foundation is workspace-scoped ownership:

```text
User -> Membership -> Workspace -> Project / Source
                              `-> role and resource grants
```

Today authenticated access is deployment-wide, source registration comes from YAML/environment
configuration, and Sessions are personal. Those constraints are acceptable for the current product
but not for independently administered teams and repositories.

## Research / Evidence

1. `pnpm verify` on the current working branch passed 130 default tests and typechecking. Ten
   PostgreSQL integration tests remained opt-in. A first build encountered an inconsistent `.next`
   output; a clean rebuild passed and verified 88 Atlas-owned Markdown files in the server traces.
2. The existing PostgreSQL egress audit measured a roughly 4.93 MB full snapshot and already
   identified source-scoped incremental reconciliation as future work, after containing repeated
   page transfer and broad database projections.
3. Atlas has explicit normalized source and application composition boundaries. Refactoring should
   strengthen these existing seams rather than invent a second architecture.
4. Ontahí packages use a coordinated release group. Atlas must upgrade all direct `@ontahi/*`
   dependencies together and must not mix alpha versions.
5. Model-backed execution treats model output as an untrusted proposal that is validated and
   reauthorized before canonical execution. Atlas should preserve that boundary when it later uses
   LLM capabilities; this plan does not add an LLM feature merely because the runtime now supports
   one.
6. OpenAI and Anthropic provider support is published in the `alpha.15` coordinated release. Atlas
   should treat provider selection as a separate product and security decision from this runtime
   compatibility upgrade.

## Scope

1. Characterize the responsibilities and regression contracts of the five concentrated modules.
2. Extract cohesive internal modules while preserving behavior, routes, source formats, persisted
   schema, and user-visible interaction.
3. Upgrade Atlas's four direct Ontahí packages in lockstep to the latest suitable published release,
   starting with an `alpha.15` compatibility pass.
4. Record which new Ontahí capabilities Atlas should adopt immediately, defer, or deliberately not
   use.
5. Shape and implement the first workspace, membership, invitation, role, and dynamic source
   registration vertical slices after the architecture and dependency gates pass.
6. Measure and design source-scoped incremental reconciliation, including correctness, recovery,
   cost, and event-coalescing consequences.

## Non-Goals

1. Do not redesign Atlas's visual language or information architecture as part of file extraction.
2. Do not rewrite the application away from Ontahí, Markdown authority, or the revisioned
   PostgreSQL projection.
3. Do not add generic plugin infrastructure before a second provider or source type proves the
   required contract.
4. Do not add an LLM chat or autonomous agent merely to demonstrate the new Ontahí APIs.
5. Do not consume unreleased Ontahí commits or mix coordinated package versions.
6. Do not implement every possible authorization role or nested resource policy in the first
   workspace slice.
7. Do not implement incremental reconciliation until the evaluation establishes invariants,
   recovery behavior, and a worthwhile cost reduction.
8. Do not introduce domain-specific adoption language or requirements into the generic Atlas core.

## Proposed Form

### Internal architecture

Keep the existing dependency direction and make its responsibilities visible:

```text
source adapters
  -> normalized records
      -> semantic parser / snapshot derivation
          -> Atlas application model and operations
              -> persistence and reconciliation adapters
                  -> server projections
                      -> viewer workspaces and detail renderers
```

Extraction boundaries should be named for responsibility rather than file size. Candidate modules
include:

1. viewer topology and navigation;
2. board/search projections;
3. detail and Markdown rendering;
4. execution-stream presentation and operation hooks;
5. source parsing and semantic inference;
6. Atlas entity/relation declarations;
7. application reads and operations;
8. PostgreSQL reconciliation, session persistence, and revision reads.

An extraction is successful only when a boundary has a small explicit API, focused tests, and no
new dependency cycle. Moving helpers between equally coupled files does not close a slice.

### Ontahí compatibility

Treat the upgrade as a consumer migration, not a version-only edit:

```text
published release inventory
  -> Atlas import/API compatibility
  -> runtime and authorization behavior review
  -> PostgreSQL SQL/traffic regression
  -> coordinated dependency update
  -> full and integration verification
```

The compatibility review must explicitly cover the current Atlas surfaces:

1. entity and relation declarations;
2. selections and physical PostgreSQL projection;
3. operation invocation and invocation context;
4. Runtime Protocol receiver and Next.js adapters;
5. React graph provider behavior;
6. mutation/observation effects even if Atlas does not adopt live observation yet;
7. model-backed Domain Operation APIs as a future Atlas capability boundary.

### Adoption model

The first collaborative form should remain intentionally small:

```text
Workspace
  |-- Membership(User, role, status)
  |-- Invitation(email/provider hint, intended role, expiry)
  |-- Project
  `-- Source(repository/provider binding, visibility, sync state)
```

Roles should initially express a compact capability matrix, for example owner, maintainer, member,
and reader. Authorization must be enforced by application operations and reads, not inferred from
hidden UI controls. Dynamic source registration should persist desired configuration separately
from observed source revisions and records.

### Incremental reconciliation evaluation

Compare the current full convergence operation with a source-partitioned alternative:

```text
provider event(source, revision)
  -> observe only affected source and evidence
  -> replace that source partition transactionally
  -> derive or update the compatible read projection
  -> publish one new projection revision
```

The evaluation must preserve full rebuild as the convergence and disaster-recovery proof. It must
also decide how a partial failure retains prior evidence, how duplicate PR/push events coalesce, and
whether the compatibility snapshot remains one value or becomes a set of revisioned projections.

## Execution Slices

### Slice 0 — characterization and extraction map

1. Inventory responsibilities, state ownership, imports, and existing tests for the five large
   modules.
2. Add characterization tests only where an intended extraction boundary lacks behavioral proof.
3. Choose the first two low-risk extractions from the viewer/parser side, which do not depend on an
   Ontahí API change.
4. Record module boundaries and forbidden dependency directions.

Gate: no production behavior changes; `pnpm verify` passes before and after each extraction.

### Slice 1 — stable structural refactor

1. Extract cohesive viewer/detail/Markdown responsibilities from `atlas-explorer.tsx`.
2. Extract execution-stream operation hooks and pure projections from its presentation component.
3. Extract pure parser/inference helpers from `build-snapshot.ts` where fixtures already establish
   the contract.
4. Keep compatibility exports temporarily when they allow small, reviewable moves.

Gate: focused tests remain near each extracted responsibility, no dependency cycles are introduced,
and observable UI/source behavior remains unchanged.

### Slice 2 — Ontahí release compatibility and upgrade

1. Compare `alpha.12` to `alpha.15` public APIs and migration guidance used by Atlas.
2. Update all four direct Ontahí packages together.
3. Adapt Atlas to one application Runtime Protocol receiver where this removes local duplication
   without expanding product scope.
4. Run default verification and all PostgreSQL integration tests against an isolated database.
5. Verify narrow SQL projections, reconciliation semantics, auth Principal propagation, operations,
   and production build traces.
6. Record model-backed operations as an available future surface; select no provider as part of the
   compatibility-only upgrade.

Gate: the upgrade has no mixed Ontahí versions and no unexplained storage, authorization, or
transport behavior change.

### Slice 3 — domain and persistence decomposition

1. Separate Atlas declarations from application reads and operations.
2. Separate full reconciliation from revision reads, Session persistence, and recovery operations.
3. Place provider-specific integration behind explicit source/evidence adapter contracts.
4. Keep transactional boundaries visible and tested rather than distributing one transaction over
   generic service layers.

Gate: the new boundaries make Workspace and Source ownership expressible without threading an
optional workspace argument through unrelated helpers.

### Slice 4 — workspace collaboration vertical slices

1. Persist Workspace and owner Membership; migrate the current deployment into one default
   workspace explicitly.
2. Scope reads, Sessions, and operations to an authorized Workspace.
3. Add invitations and a compact role/capability policy.
4. Persist Source registrations and their provider bindings inside a Workspace.
5. Add a reviewed registration/removal flow and visible synchronization state.

Gate: two Workspaces with different members and sources cannot observe or mutate one another, and
the current single-workspace deployment has a documented migration/rollback path.

### Slice 5 — incremental reconciliation decision

1. Capture baseline bytes, duration, provider calls, rows, and revision size for full
   reconciliation at several corpus sizes.
2. Prototype one source-partitioned reconciliation behind a non-production path.
3. Test duplicate, out-of-order, missing, and partially failed provider events.
4. Compare full rebuild convergence and resulting snapshots.
5. Produce an explicit implement/defer decision with expected savings and remaining complexity.

Gate: implementation proceeds only if it preserves convergence and materially improves a measured
resource or latency constraint.

## Verification

- [ ] Each extracted module has one explicit responsibility and focused behavioral coverage.
- [ ] No extraction changes routes, source identity, persisted schema, or visible interaction unless
      a later product slice explicitly owns that change.
- [x] Atlas consumes one coordinated, published Ontahí version across all direct packages.
- [x] Default tests, typecheck, production build, source-trace verification, and PostgreSQL
      integration tests pass after the Ontahí upgrade.
- [ ] PostgreSQL physical projections and reconciliation traffic do not regress after the upgrade.
- [ ] Workspace reads and operations enforce membership at the application boundary.
- [ ] Invitations have explicit lifecycle, expiry, role intent, and acceptance authorization.
- [ ] Dynamic source configuration is persisted separately from observed revisions and records.
- [ ] Cross-workspace isolation is proven in integration tests.
- [ ] Incremental reconciliation receives a measured implement/defer decision and preserves full
      rebuild as a convergence proof.

## Decisions

1. Adoption readiness is generic Atlas work; it carries no organization-specific model or naming.
2. Refactoring precedes new collaboration features, but only Ontahí-independent extraction should
   precede the dependency upgrade.
3. Atlas upgrades only to coordinated published Ontahí releases, never arbitrary upstream commits.
4. Model-backed operations are a useful new capability boundary, not an immediate product feature.
5. Workspace authorization and dynamic source registration are one ownership problem and should be
   shaped together after the architectural gates.
6. Incremental reconciliation remains a decision study until its benefits and correctness costs are
   measured.

## Open Questions

1. Which viewer extraction gives the largest ownership improvement with the smallest regression
   surface: Markdown rendering, detail projection, map layout, or board/search projection?
2. Does Ontahí `alpha.15` let Atlas delete either of its current Runtime Protocol route wrappers,
   or are they still meaningful host policy boundaries?
3. Should a Source belong directly to one Workspace, or can a separately administered Source be
   mounted into several Workspaces through grants?
4. Should invitation identity initially be email-based, provider-account-based, or support both
   while keeping acceptance bound to a proven User?
5. Is a fixed built-in role set sufficient for the first collaboration slice, or does one real
   adoption pilot require resource-specific grants immediately?
6. Can source-partitioned rows produce the current compatible snapshot without reading all Markdown
   bodies back into the application process?

## Closure / Evolution

### 2026-10-25 — initial adoption assessment

The first repository assessment established that Atlas has a credible federated and durable base,
but its implementation boundaries, coordinated Ontahí version, and deployment-wide ownership model
should be addressed before broad collaboration features. The current branch passed 130 default
tests and typechecking; all ten PostgreSQL cases remain an explicit integration run. A clean
production build passed after removing an inconsistent generated `.next` directory.

Ontahí upstream verification initially found Atlas two coordinated releases behind. The subsequent
`alpha.15` release publishes provider-neutral model-backed Domain Operation execution together with
OpenAI and Anthropic providers. Atlas will consume the coordinated runtime release while leaving
provider selection and any LLM-facing behavior outside this compatibility slice.

No application implementation begins in this checkpoint. Slice 0 owns the first executable work:
characterize boundaries and select the smallest behavior-preserving extractions.

### 2026-10-25 — first structural extraction

The first behavior-preserving boundary moved the Session Plan-tree projection and canonical source
label derivation out of `execution-stream-view.tsx` into
`src/atlas/viewer/execution-stream-tree.ts`. The extracted module is framework-independent and has
focused coverage for deterministic ordering, collapsed descendants, promotion of active children
through hidden done Plans, and canonical source labels. The existing component suite continues to
exercise the complete Session interaction.

This slice deliberately avoided `atlas-explorer.tsx`, `atlas-application.ts`, and
`build-snapshot.ts` because the current working branch already contains unrelated edits in those
files. It establishes the extraction pattern without entangling that work.

`pnpm verify` passes with 137 default tests, typechecking, a production build, and 89 verified
Atlas-owned Markdown files. Ten opt-in PostgreSQL integration tests remain skipped by the default
suite and are required at the Ontahí upgrade gate.

### 2026-10-25 — Ontahí `alpha.15` release and Atlas compatibility

Ontahí `1.0.0-alpha.15` was released as one coordinated prerelease and Atlas upgraded
`@ontahi/core`, `@ontahi/postgres`, `@ontahi/react`, and `@ontahi/runtime-nextjs` together from
`alpha.12`. The consumer compatibility pass required no Atlas API adaptation: current graph
declarations, PostgreSQL mapping, operation invocation, Runtime Protocol routes, Principal
propagation, and React graph usage compile and retain their existing tests.

`pnpm verify` passes with 137 default tests, typechecking, a production build, and 89 verified
Atlas-owned Markdown files. The separate `pnpm test:postgres` gate passes all ten cases against a
temporary PostgreSQL 18 container. Provider packages are now published upstream, but Atlas does not
select a model provider or introduce LLM-facing behavior in this slice.

### 2026-10-25 — `alpha.15` declaration and application API review

The declaration review adopted Ontahí's unified `entity.ref(...)` surface for the remaining forward
and cyclic Entity references. References used only as nominal relation targets no longer duplicate
their complete Field maps, while references traversed by typed Atlas Queries retain the minimum
Field contract those Queries require. Relations to Entities already declared now target the real
declaration directly instead of an unnecessary semantic placeholder.

The review deliberately did not mechanically replace persisted scalar foreign-key Fields with
`field.ref(...)`. Doing that well requires a separately shaped storage migration because it changes
the semantic value contract and inferred relation/mapping surface, even if the physical columns can
ultimately remain stable. Likewise, `defineGraphReadPolicy`, model-backed Operations, mutation
Reactions, and provider adapters solve future remote authorization, automation, and lifecycle
problems; none removes Atlas's current server-owned projection reads without changing behavior.

The remaining size of `atlas-application.ts` is therefore primarily an ownership/module-boundary
problem, not obsolete Ontahí plumbing. Slice 3 should separate declarations, read projections, and
application composition while preserving one `ontahi(...)` root. Focused application, runtime, and
PostgreSQL mapping tests plus typechecking pass after the declaration cleanup.
