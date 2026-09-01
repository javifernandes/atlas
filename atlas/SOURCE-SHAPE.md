# Atlas Source Shape v0

The Workstream Atlas is markdown-first. This document defines the first explicit source shape for atlas items and the extraction boundary between source markdown, extracted graph data, and UI projections.

`item` and `node` are technical words for source records and graph rendering. The product word is **shape**: a durable conceptual form that can emerge, be explored, materialize, gain evidence, drift, split, merge, be promoted, or be retired.

Atlas users and LLM agents shape and re-shape these forms over time. The source format still calls each markdown declaration an item because the parser needs a simple neutral record type.

This is a working contract. Prefer small additions that answer real product-control questions over speculative lifecycle fields.

## What The Atlas Tracks

An atlas describes a system through linked planes:

1. **Model / ontology**: durable shapes such as concepts, entities, operations, capabilities, experiences, artifacts, states, policies, projects, practices, and relations.
2. **Strategic intent and work history**: goals, plans, PRs, decisions, chats, follow-ups, replacements, abandoned ideas, and closures.
3. **Evidence**: code, tests, Storybook stories, migrations, deployments, metrics, docs, and other artifacts that ground a model item.
4. **Operating practice**: agreements about how people work on the system, such as dual grounding, archaeological reading, closure rituals, and backfill strategy.

Goals and plans do not define the current system by themselves. Goals describe desired outcomes; plans are interventions that advance goals and shape, materialize, replace, or question atlas items.

Projects are also shapes. A project shape may start inside another project or repository, then gain enough identity to become independently planned while still being managed in the same atlas.

## File Layout

Atlas items live under `atlas/items/`.

```txt
atlas/items/<project>.md
atlas/items/<project>/<item>.md
atlas/items/<project>/<item>/<child>.md
```

The folder path is for human navigation. The stable identity is the `id` frontmatter field.

## Item Frontmatter

```yaml
id: spec-workstream-atlas.atlas-model.model-item
kind: concept
title: Model Item
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: now
supports:
  - spec-workstream-atlas
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
exemplars:
  - bookops.model.book
  - ontahi.model.entity
evidence:
  - type: code
    href: https://github.com/javifernandes/atlas/blob/main/src/atlas/markdown/build-snapshot.ts
```

### Stable Fields

1. `id`: stable dotted identifier.
2. `kind`: item kind from the v0 kind set.
3. `title`: human-facing name.
4. `parent`: semantic parent id. Root projects omit it.
5. `status`: semantic status of this item, not plan kanban.
6. `horizon`: loose planning horizon.
7. `supports`: other items or root projects supported by this item.
8. `relatedPlans`: markdown plans that shaped or currently shape this item.

### Experimental Fields

1. `evidence`: explicit links to code, tests, stories, deployments, docs, or metrics.
2. `relations`: explicit semantic relations beyond parent/supports/relatedPlans.
3. `aliases`: historical or alternate names.
4. `mentions`: unresolved terms that may later become items.
5. `exemplars`: atlas ids that act as concrete examples or referents for this item.
6. `typeOf` and `instanceOf`: semantic typing relations used when an item names a model type or a concrete instance of one.
7. `repositories`: repository bindings for project shapes or implementation-backed shapes.
8. `paths`: source paths inside a repository that ground this shape.

Experimental fields may be ignored by the current UI until the extractor supports them.

## Declarations And References

The atlas source shape distinguishes three related moves:

1. A declaration creates or updates a named atlas item.
2. A reference points from source text to a named atlas item.
3. An exemplar reference says another atlas item is a concrete case, referent, or example of this item.

`exemplars` is not a separate linking mechanism. It is a list of atlas references with the semantic role "example of this item."

Markdown frontmatter is the current declaration surface:

```yaml
id: bookops.model.book
kind: entity
title: Book
typeOf:
  - ontahi.model.entity
```

Markdown body references may eventually support wiki-style links and URI-style links:

```md
The [[bookops.model.book|Book]] can be shared with a [[bookops.model.collaborator|Collaborator]].

The [Book](atlas:bookops.model.book) can be shared with a [Collaborator](atlas:bookops.model.collaborator).
```

LaTeX-like source surfaces could declare and reference the same graph without changing the extracted model:

```tex
\atlasDeclare{bookops.model.book}{kind=entity, title="Book"}
\atlasTypeOf{bookops.model.book}{ontahi.model.entity}
\atlasRef{bookops.model.book}
```

The syntax is a surface concern. The extractor should normalize all supported surfaces into the same graph of atlas ids, relations, unresolved mentions, and evidence.

## Project Shapes And Repository Bindings

A project is a first-class shape.

Project shapes may bind to one or more repositories or paths:

```yaml
repositories:
  - owner: javifernandes
    name: bookops
paths:
  - atlas/items/spec-workstream-atlas
  - plans
```

V0 should treat repository bindings as evidence hints, not as a complete source-control model.

Examples:

1. BookOps maps to the BookOps repo.
2. Ontahi still partly lives inside the BookOps repo, but also has external documentation/library repos.
3. Workstream Atlas currently lives inside BookOps, but may later become a separate project shape while still being managed in the same atlas.

This binding is what lets Atlas connect shapes to implementation: code, tests, stories, docs, PRs, and deployment evidence.

## Semantic Signals

Inline references say that a source mentions an atlas item. Semantic signals say how the source touches that item.

Use Markdown callouts when a plan, item, note, or documentation page contains a durable signal about an atlas item:

```md
> [!FUTURE]
> target: [[ontahi.model.durable-operation|Durable Operation]]
> Durable operation metadata could become the single source for generated task/workflow descriptors and runtime-safe step wrappers.

> [!TENSION]
> target: [[ontahi.model.durable-operation|Durable Operation]]
> Import book should be able to run its full logic in a cloud agent, but the current implementation still assumes filesystem access.
>
> possible: Explore a cloud durable operation runtime with explicit source adapters.
```

The v0 signal vocabulary is intentionally small:

1. `FUTURE`: possible evolution, idea seed, or future branch.
2. `TENSION`: unresolved pressure, contradiction, mismatch, or constraint.
3. `QUESTION`: open conceptual, product, or implementation question.
4. `DECISION`: chosen direction or rejected alternative.
5. `EVIDENCE`: proof, implementation anchor, or validation signal.

Signals can live anywhere. A future idea about `Entity` can be written inside a plan about workflows, a documentation page, or the entity item itself. The atlas should collect those signals back onto the target item.

## Kinds

The v0 kind set is intentionally broad enough to name what we already discuss in plans:

1. `project`: a root system or extracted project.
2. `territory`: a broad area within a project.
3. `model`: a named model or ontology area when `territory` is not precise enough.
4. `concept`: a model term that may or may not become code.
5. `experience`: a human-facing or operator-facing workflow.
6. `capability`: something the system can do.
7. `entity`: a domain or persisted object.
8. `operation`: an action the system or a person can perform.
9. `artifact`: generated, persisted, rendered, or derived output.
10. `policy`: a rule, constraint, permission, or invariant.
11. `state`: a named lifecycle or product state.
12. `relation`: a named relationship between model items.
13. `system-primitive`: a low-level framework primitive.
14. `tooling`: supporting developer or operational tooling.
15. `evidence`: a grouped evidence area.
16. `practice`: a working agreement or repeatable operating method.

Avoid adding kinds because they sound elegant. Add them when they improve navigation, closure, evidence review, or stale-state detection.

## Relations

The current UI understands a small relationship set:

1. `parent`: tree containment.
2. `supports`: support across items or projects.
3. `relatedPlans`: plan-to-item shaping history.

Future explicit relation fields should distinguish at least:

1. `shapes`: work item influences a model item.
2. `materializes`: work item produces implementation evidence.
3. `replaces`: one model item or plan supersedes another.
4. `depends-on`: one item requires another.
5. `evidenced-by`: model item is grounded by concrete evidence.
6. `mentions`: a plan references a model term without resolving it yet.
7. `type-of`: one item is a specialization or model-level case of another.
8. `instance-of`: one item is a concrete runtime/domain instance of another.

## Federated Source Identity

Atlas normalizes provider-specific Markdown files before semantic parsing:

```ts
type NormalizedAtlasSourceRecord = {
  sourceId?: string;
  sourcePath: string;
  canonicalPath: string;
  sourceFilePath?: string;
  content: string;
};
```

`sourcePath` is the repository-relative physical path. `canonicalPath` is the stable graph identity
used after a repository is mounted, for example `atlas://plans/111-atlas-as-ontahi-application`.
`sourceFilePath` remains available for source navigation without becoming semantic identity.

The standalone Atlas repository is an intrinsic source with id `atlas`. Its repository-local
`plans/` and `atlas/items/` directories are loaded without an external registry entry. Configured
sources such as BookOps and Ontahi keep their own source ids and authority. The `atlas` source id is
reserved and cannot be configured as an external source.

Within a source-owned Atlas Item, a repository-local `relatedPlans` value such as
`plans/done/111-atlas-as-ontahi-application.md` resolves inside the item's `sourceId`. An
explicit URI such as `ontahi://plans/...` keeps its declared source and represents a cross-source
reference. Authors therefore use ordinary repository paths for local declarations and canonical
URIs only when ownership crosses a source boundary.

When ownership of a Plan moves between repositories, the old source may keep a minimal relocation
stub containing a canonical identity:

```md
Relocated to Ontahi.

- Canonical ID: `ontahi://plans/74a-unit-of-work-runtime-scope`
```

The extractor treats the old canonical path as an alias to that identity. It resolves item and
Plan references through the alias, excludes the stub from the Plan/document collection, and uses
the canonical source's folder and metadata for status. The stub preserves navigation; it does not
become a second historical Plan.

## Extraction Boundary

Extraction should produce a graph, not a UI layout.

```ts
type AtlasItem = {
  id: string;
  kind: string;
  title: string;
  parent?: string;
  status: string;
  horizon?: string;
  supports: string[];
  relatedPlans: string[];
  exemplars?: string[];
  relations?: AtlasRelation[];
  evidence?: AtlasEvidence[];
  references?: AtlasReference[];
  markdown: string;
};
```

The map UI is a projection over that graph. It can collapse branches, hide relation noise, dim unrelated nodes, or render details differently without changing the source contract.

## Dual Grounding

Every new concept should be checked against two cases:

| Atlas concept | Reflective case in Workstream Atlas | Concrete case in BookOps |
| --- | --- | --- |
| Item | Atlas Item, Plan, Evidence Binding, Relation | BookOps, Book, Collaborator, Invitation |
| Experience | Model Authoring, Plan Closure | Reader Experience, Sharing |
| Operation | Promote Mention To Model Item | Accept Invitation |
| Evidence | Parser code, canvas UI tests | DB schema, Storybook, product tests |
| Practice | Dual Grounding | Archaeological reading of old BookOps plans |

If a concept only works reflectively, it may be too abstract. If it only works in BookOps, it may be too local.

## Archaeological Reading

Historical plans are evidence, not canonical truth. When reading old plans:

1. preserve the original plan unless a rewrite clearly improves future navigation,
2. extract durable model items from repeated terms and decisions,
3. mark contradictions and stale assumptions instead of hiding them,
4. link follow-ups that were buried in done plans,
5. prefer small backfills over wholesale migration.

## Product-Control Questions

The source shape should help answer:

1. What exists now?
2. What is in progress?
3. What is done only historically but incomplete as a capability?
4. What is stale or out of sync?
5. Which plans shaped this item?
6. Which concepts repeat across plans?
7. Which evidence proves this item exists?
8. Which follow-ups are buried?
9. What should be updated when a plan closes?
10. What changed after a PR?
