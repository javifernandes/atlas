# 159. Work Classification And Evolution Facets

Status: current
Advances: spec-workstream-atlas.goal.legible-system-evolution
Work Nature: feature
Impact Scopes: data-shape
Compatibility: compatible

## Summary

Give Plans, Pull Requests, Changesets, and related work evidence a small shared vocabulary for
describing the nature and impact of a change without reducing the subject of the work to a label.

The first pilot is Ontahí's ongoing source reorganization: several Plans and Pull Requests move
core entities out of the historically named `data-graph` wrapper. The line is primarily a
technical refactor of Ontahí's internal organization, while its import changes may affect public
consumer surfaces. Atlas should make that character visible across intermediate releases and in
the evolution of the durable system form being reshaped.

## Context

Release and Pull Request history currently treats unlike changes as a flat stream. A feature, bug
fix, migration, refactor, and documentation correction may all appear adjacent even though they
answer different questions about system evolution.

Generic labels alone do not explain what changed. `refactor` names the character of an
intervention, but not the durable subject it reshaped. Conversely, creating a first-class Atlas
Item for every classification would turn navigation into taxonomy management. Atlas needs to
separate:

1. the durable subject being changed;
2. the nature of the work;
3. the scope and compatibility impact of the change;
4. the evidence that proves the change and its release.

## Research / Evidence

1. Ontahí has an ongoing multi-PR, multi-release reorganization whose semantic unity is larger
   than any individual Pull Request or Changeset.
2. The name `data-graph` no longer describes the boundary it contains because those entities have
   become part of Ontahí's core model.
3. Moving files is internally motivated, but changed imports can affect public consumers and may
   require migration guidance.
4. [[spec-workstream-atlas.atlas-model.work-item|Work Item]] already distinguishes temporal work
   from durable system form.
5. [[spec-workstream-atlas.atlas-model.relation-model|Relation Model]] already reserves `shapes`
   and `affects` for connecting work to durable subjects.
6. [102. Atlas Implementation And Release Evidence](./102-workstream-atlas-implementation-evidence.md)
   will connect Plans and Items to Changesets, Component Versions, and Releases.

### Ontahí Plan 171 pilot inventory — 2026-11-23

The authoritative line is `ontahi://plans/171-core-model-and-runtime-boundaries`, which shapes
`ontahi.source-code-organization`. Its observable history already validates the distinction
between subject, work nature, impact, and release evidence:

| Moment | Evidence | Nature | Impact / compatibility |
| --- | --- | --- | --- |
| Establish model and runtime boundaries | Ontahí PRs [#326](https://github.com/javifernandes/ontahi/pull/326)–[#330](https://github.com/javifernandes/ontahi/pull/330) | refactor · technical | internal organization; established public exports preserved |
| Publish the first boundary extraction | `@ontahi/core@1.0.0-alpha.21`, release PR [#322](https://github.com/javifernandes/ontahi/pull/322) | release of refactor work | compatible; first known released materialization of Plan 171 |
| Continue runtime and compatibility extraction | Ontahí PRs [#331](https://github.com/javifernandes/ontahi/pull/331), [#334](https://github.com/javifernandes/ontahi/pull/334)–[#338](https://github.com/javifernandes/ontahi/pull/338) | refactor · technical | mixed internal and public-surface impact; compatibility facades retained |
| Prepare the next published checkpoint | open release PR [#333](https://github.com/javifernandes/ontahi/pull/333) for `1.0.0-alpha.22` | release of refactor plus adjacent feature work | candidate, not yet published evidence |
| Continue relation and mutation extraction | active Ontahí branch `codex/core-model-runtime-boundaries-slice-10-mutations` | refactor · technical | unreleased and still changing; must not be presented as shipped |

This is one durable subject and one Plan, but not one homogeneous release. `alpha.21` also contains
replicated-model work from Plan 169, while the `alpha.22` candidate includes a materializer feature
beside Plan 171 refactors. Release-level classification must therefore be a composition of included
change records, not one label copied onto the entire Release.

The pilot initially exposed evidence-quality differences:

1. PRs 326–330 referred to Plan 171 with human-readable variants such as `Atlas plan:` or
   `Implements`, which the current Atlas PR directive parser does not ingest.
2. PRs 331, 334, 335, 336, and 338 already used supported `Atlas-Implements` and, where applicable,
   `Atlas-Shapes` directives.
3. PR 337 was part of the Plan 171 checkpoint but lacked a supported directive in its observed
   body.
4. Changesets explain consumer-visible release impact, but internal architecture checkpoints can
   intentionally use empty Changesets and disappear from generated package notes.
5. The open `alpha.22` release PR is candidate evidence; only a merged publication and provider
   observation can establish a released Component Version.

These differences should remain visible as provenance and completeness signals rather than being
silently normalized into equally strong claims.

On 2026-11-23, the merged PR bodies for 326–330 and 337 were migrated in place to the canonical
pair:

```txt
Atlas-Implements: ontahi://plans/171-core-model-and-runtime-boundaries
Atlas-Shapes: ontahi.source-code-organization
```

Each final GitHub body was re-read and verified to contain exactly one copy of each directive. The
migration changes author assertions, not commits, Changesets, release notes, or Plan status. Atlas
can ingest the corrected bindings on its next authoritative GitHub reconciliation; the historical
absence remains relevant operational context but is no longer the current evidence state.

## Scope

1. Define a bounded v0 work-nature vocabulary shared by Plans and observed delivery evidence.
2. Keep work nature separate from the Atlas Item or implementation boundary being shaped.
3. Represent impact scope and compatibility pressure independently from work nature.
4. Let a coherent line of work retain identity across several Plans, PRs, and intermediate
   Releases without making a release act as its owner.
5. Project classifications into item evolution and Release Stories as filters and narrative cues.
6. Pilot the model against the Ontahí source-organization refactor.

## Non-Goals

1. Do not build a generic user-defined tagging system in v0.
2. Do not infer semantic classification solely from changed paths or commit prefixes.
3. Do not make `technical` synonymous with low impact or internal-only behavior.
4. Do not turn every recurring label into a durable Atlas Item.
5. Do not require one classification to describe an entire mixed Pull Request.
6. Do not replace typed relations such as `shapes`, `affects`, `implements`, or `evidences` with
   labels.

## Proposed Form

### Two layers, not one taxonomy

The durable subject and the work facets answer different questions:

```txt
Ontahí Source Organization        durable subject
  <- shaped by Plan A             intended intervention
  <- shaped by PRs 1, 2, 3        observed implementation evidence
  <- materialized in alpha.x–y    availability history

Plan / PR facets
  nature: refactor
  domain: technical
  impact: public-surface
  compatibility: migration-required
```

`Ontahí Source Organization` may earn an Atlas Item because it has durable identity, invariants,
decisions, and an evolution that survives the current refactor. `refactor` should remain a facet
because it classifies many unrelated interventions and has little useful evolution of its own.

### Bounded v0 vocabulary

Start with one required-at-most-once work-nature facet:

- `feature`
- `fix`
- `refactor`
- `migration`
- `maintenance`
- `research`
- `documentation`

Treat `technical` as an optional domain or audience facet rather than another work nature. A
feature may also be technical, and a refactor may reshape a product-visible contract.

Model impact separately with a small vocabulary such as:

- `internal`
- `public-surface`
- `consumer-behavior`
- `data-shape`
- `operational`

Compatibility is evidence-bearing metadata rather than implied by nature:

- `compatible`
- `migration-required`
- `breaking`
- `unknown`

The exact names remain a plan output. The invariant is that these axes remain distinct.

### Authored and observed metadata

Plans may author their intended classification in frontmatter. Pull Requests or Changesets may
assert the classification closest to delivery. Atlas preserves provenance and disagreement rather
than silently copying Plan intent onto every PR.

```yaml
workNature: refactor
workDomains:
  - technical
impactScopes:
  - public-surface
compatibility: migration-required
shapes:
  - ontahi.implementation.source-organization
```

The syntax is illustrative until the parser and evidence contract are decided. GitHub labels may
be an input or convenience, but repository-global label names are not automatically canonical
Atlas semantics.

### Coherent lines across releases

A multi-PR effort should first derive its coherence from shared Plan and Item bindings. Introduce
a separate first-class change initiative only if the pilot proves that several Plans need an
identity that neither Goal, Plan, Item, nor execution Session can provide.

## Execution Slices

### Slice 0: Ontahí exemplar

1. [x] Name the durable source-organization subject and its intended form in Ontahí's authoritative
   repository rather than copying its item tree into Atlas.
2. [x] Inventory the related Ontahí Plans, Pull Requests, Changesets, and intermediate Releases.
3. [x] Classify the evidence manually using candidate nature, domain, impact, and compatibility
   axes.
4. [x] Identify cases where a single label would lose important meaning.

### Slice 1: Source and evidence contract

1. Decide the minimal frontmatter shape for authored Plan classification.
2. Decide how PRs and Changesets assert or inherit classification with provenance.
3. Add parser/model validation for the bounded vocabulary.
4. Preserve unknown and mixed cases without inventing certainty.

### Slice 2: Evolution projection

1. Add compact facet cues to Plan and evidence rows.
2. Filter or group an Item's evolution by work nature and impact.
3. Let Release Stories summarize work composition without hiding individual evidence.
4. Test whether custom workspace vocabularies are needed after the fixed pilot is used.

## Verification

- [ ] The Ontahí reorganization is visible as one durable subject shaped by several work records.
- [ ] `refactor` can classify the work without becoming the subject of its history.
- [ ] Internal motivation and public import impact can both be represented.
- [ ] Plans, PRs, and Changesets retain the provenance of their classifications.
- [ ] Intermediate Releases show their contribution to the longer refactor line.
- [ ] Evolution can be filtered or grouped without removing the underlying chronological story.
- [ ] Unclassified historical work remains valid.
- [ ] The pilot determines whether custom labels are necessary before Atlas adds them.

## Decisions

1. Separate durable work subjects from reusable work facets.
2. Start with a bounded vocabulary, not arbitrary custom labels.
3. Keep nature, domain, impact, and compatibility as independent axes.
4. Use typed relations to explain what work shaped; do not ask labels to carry graph semantics.
5. Let shared Plan and Item bindings establish a multi-PR line before adding another entity type.
6. Preserve authored and observed classification provenance.

## Open Questions

1. Can a Pull Request override or only refine the intended classification of its Plan?
2. Does a mixed PR carry multiple classified change records, or only a primary nature plus notes?
3. Should GitHub labels map through workspace configuration or remain provider-local evidence?
4. When does a long-running line of work deserve identity beyond its subject and Plans?
5. Which import changes are `migration-required` versus formally `breaking` before 1.0?

## Closure / Evolution

Opened on 2026-11-23 from the Ontahí source-organization refactor case. The initial decision is to
test a bounded, faceted classification against a real multi-PR and multi-release line before
introducing customizable labels or a new change-initiative entity.

The first evidence pass confirms that classification belongs on included work records rather than
on a Release as a whole. It also confirms that the durable subject already exists in Ontahí as
`ontahi.source-code-organization`; Atlas should federate that identity instead of creating a local
copy. Slice 0 is complete as a manual model probe. The next slice is the authored and observed
metadata contract.

The same pass repaired the Plan 171 evidence chain by standardizing merged PRs 326–330 and 337 on
the supported `Atlas-Implements` and `Atlas-Shapes` directives. Existing commits and Changesets
remain unchanged because PR-body assertions are the current ingestion contract.
