# 149. Interaction Model v0

Status: current

Definition level: shaping

## Summary

Define `Interaction` as an Atlas Item Type that preserves how an actor perceives system state,
chooses among affordances, and traverses Operations to reach a goal inside a semantic boundary.
Use the already implemented Workspace contributor-review experience as the first exemplar, so the
model is shaped against real product behavior rather than an invented workflow.

Interaction Model v0 inverts the usual implementation-first development path. Instead of losing a
product interaction while decomposing it into React components, endpoints, ingresses, queries, and
domain Operations, Atlas keeps the interaction as a durable source that those implementation
elements can realize and evidence over time.

## Context

The Package, Entity, and Operation experiments established progressively stronger system
descriptions. Package preserves an implementation and semantic boundary. Entity describes durable
state, relations, invariants, and indexed behavior. Operation owns one invocable behavior contract.
None of them preserves the actor-facing reason several readings, decisions, navigations, and
Operations belong together.

Today this intent usually exists temporarily in product conversations, sketches, tickets, or the
developer's head. Implementation then begins from the opposite direction: routes, endpoints,
components, event handlers, and mutations. Once those pieces land, recovering the original
interaction requires reverse engineering the code and often confuses the current UI realization
with the durable product need.

Workspace contributor administration provides a grounded example. Atlas already lets an owner
review contributor evidence in Workspace Settings. That experience presents observed
participation, linked identity and access status, and can later offer invitation affordances. The
same functional interaction could move to a graph node, command palette, notification, assistant,
or dedicated administration view without changing its purpose.

Related work:

1. [`Atlas Item Type Model`](../next/108-atlas-item-type-model.md)
2. [`Workspace Sources And Contributor Discovery`](140-workspace-sources-and-contributor-discovery.md)
3. [`Workspace Administration Settings`](142-workspace-administration-settings.md)
4. [`Package Manifest And Classroom Model`](146-package-manifest-and-classroom-model.md)
5. [`Interaction`](../../atlas/items/spec-workstream-atlas/atlas-model/interaction.md)

## Research / Evidence

1. Classroom Entity and Operation Items prove that receiver, actor, applicability, inputs, effects,
   failures, and invariants can remain independently navigable instead of being repeated in a
   screen-flow document.
2. Workspace Settings already implements `Review Discovered Contributors`, but its product intent
   is implicit across Graph Queries, derived contributor rows, membership state, settings sections,
   and future invitation mutations.
3. Reading information is part of product behavior even when it invokes no mutating Operation.
   `Owner reviews contribution evidence` is meaningful interaction anatomy but not necessarily a
   domain Operation.
4. A click, email link, OAuth callback, or webhook is an external stimulus or ingress. It may invoke
   an Operation, but should not be mislabeled as domain behavior merely to make a diagram uniform.
5. Several interactions can share one Entity scope and compose by opening another interaction or
   continuing after a typed result. Composition does not require a separate `CompositeInteraction`
   category.
6. An invitation may address a known Atlas User, an observed GitHub identity, or a verified email.
   Identity proof, invitation claim, and invitation acceptance remain separate responsibilities;
   matching email or provider data must not silently merge Atlas Users.
7. The `Respond To Workspace Invitation` shaping experiment exposed that a screen storyboard is
   already too opinionated for the durable Interaction. The same model needs a spatial Graph lens
   and a textual Blueprint lens over one projection.
8. A service-blueprint reading makes the actor path primary while aligning system behavior, rules
   and validation, and external systems beneath the same interaction moments.
9. The invitation-resolution drill-down exposed that the earlier contextual-fork prototype mixed
   three independent concerns: invitation lifecycle, actor authentication state, and invitation
   addressing policy. An activity graph can keep those decisions separate while showing every
   branch, guard, affordance, merge, Entity read, and Operation boundary together.
10. A case-specific selector is useful for exploring scenarios, but it is not a durable Interaction
    representation. Atlas needs one semantic Activity Graph from which scenario simulation, Graph,
    Blueprint, and later Play projections can derive.
11. Mermaid is useful interchange and may remain a rendering or export option, but it cannot be the
    authoritative model. Atlas must preserve distinctions Mermaid does not own, including guard
    versus affordance, actor action versus system responsibility, Entity reads, Operation and child
    Interaction references, external stimuli, and local versus independently addressable elements.
12. Atlas already depends on `yaml` and parses YAML in the Markdown ingestion layer. The first
    structured authoring form can use that maintained parser rather than introducing a handwritten
    YAML subset or a premature custom textual language.

## Scope

1. Define the smallest useful Interaction anatomy: scope, goal, actors, context, presented
   information, affordances, steps, outcomes, and references.
2. Distinguish semantic scope from compositional parenthood. `Review Discovered Contributors` is
   scoped to one Workspace and contained by broader contributor-management interactions.
3. Allow an Interaction to contain or reference other Interactions without an atomic/composite type
   split.
4. Reference Operations rather than duplicating their preconditions, effects, failures, or
   invariants.
5. Represent external stimuli and ingresses explicitly enough to avoid pretending every visible
   step is an Operation.
6. Derive an activity/flow reading for a composed interaction and support drill-down into a child
   interaction.
7. Use `Review Discovered Contributors` as the first authored and rendered exemplar.
8. Identify how the current Workspace Settings implementation can later bind as realization
   evidence without making realization metadata mandatory in v0.
9. Prototype Graph and Blueprint lenses over one shared Interaction projection, with Graph as the
   default and a shared semantic inspector for both.
10. Define a renderer-independent Activity Graph semantic model with typed nodes, transitions,
    context bindings, and semantic references.
11. Keep YAML parsing, semantic validation and reference resolution, lens projection, and React
    rendering as separate modules with focused unit tests.
12. Use a fenced YAML activity block as the first explicit authoring form while preserving the
    semantic model as authority inside Atlas after parsing.
13. Validate the model against three deliberately different pressures: responding to a Workspace
    invitation, importing a Workspace Source in the background, and configuring a Workspace model
    connection.

## Non-Goals

1. Do not make Interaction an Ontahí runtime primitive or executable workflow in v0.
2. Do not generate React components, routes, forms, Graph Queries, or ingresses from Interaction
   source yet.
3. Do not introduce Event, Outcome, Actor, Affordance, Journey, Workflow, or Composite Interaction
   as new Atlas Item Types.
4. Do not duplicate Operation applicability, authorization, inputs, effects, or invariant rules in
   Interaction Markdown.
5. Do not require `realizedBy` links before the Interaction model is useful.
6. Do not redesign the complete Workspace invitation and membership implementation in this plan;
   use it as pressure and a follow-up adoption target.
7. Do not require one interaction tree to match product navigation or component hierarchy.
8. Do not implement generated or executable UI in the first lens prototype. Preserve a future
   `Play` lens as architectural pressure without treating it as product design.
9. Do not make Mermaid syntax, layout decisions, or generated SVG the source of semantic truth.
10. Do not design a compact custom textual DSL, visual editor, or round-trip source formatter before
    the semantic model and YAML experiment survive the three exemplar interactions.
11. Do not add wait, retry, compensation, parallel fork/join, timeout, or durable-execution
    primitives speculatively. Add them only when one exemplar demonstrates a missing semantic.
12. Do not promote Activity, Decision, Affordance, Stimulus, Merge, or Outcome to global Atlas Item
    Types merely because they are locally typed Activity Graph elements.

## Proposed Form

### Semantic boundary and composition

Scope establishes the local domain world in which an Interaction is evaluated. Parent establishes
functional composition:

```text
Workspace scope
  Manage Workspace
    Manage Contributors
      Review Discovered Contributors
      Invite Person To Workspace
      Manage Membership
    Manage Sources
      Review Connected Sources
      Connect Repository
      Remove Source
```

The tree is not a menu. Settings, the graph, a notification, an assistant, or another surface may
realize the same Interaction.

### Interaction Model v0

```text
Interaction
  scope         Entity instance or semantic boundary
  goal          actor-facing intent preserved across realizations
  actors        primary actor and relevant participants
  context       state required for the interaction to make sense
  presents      information the actor must be able to perceive
  affordances   inspect, navigate, open Interaction, or invoke Operation
  steps         ordered or branching references to Operations, Interactions, and stimuli
  outcomes      meaningful completion, refusal, abandonment, or unavailable results
```

The model deliberately separates three layers:

```text
Interaction
  what actors need to perceive and do

Realization
  where controls, routes, components, and presentation implement that need

Operation / Query / Ingress
  how the system reads state, executes behavior, and accepts external stimuli
```

### First exemplar

```md
---
id: spec-workstream-atlas.workspace.interactions.review-discovered-contributors
kind: interaction
title: Review Discovered Contributors
parent: spec-workstream-atlas.workspace.interactions.manage-contributors
scope:
  entity: AtlasWorkspace
  binding: workspace
status: shaping
horizon: now
---

## Goal

Decide which observed contributors should receive explicit Workspace access.

## Actors

| Actor           | Participation                                  |
| --------------- | ---------------------------------------------- |
| Workspace Owner | Primary actor reviewing possible collaborators |

## Context

| Requirement                                       |
| ------------------------------------------------- |
| At least one Source is connected                  |
| Contributor evidence has been reconciled          |
| Current User may manage Workspace membership      |

## Presents

| Information          | Source                                      |
| -------------------- | ------------------------------------------- |
| Observed contributor | contributor participation projection        |
| Evidence summary     | registered Sources and merged Pull Requests |
| Identity status      | linked External Identity and Atlas User     |
| Access status        | [Workspace access](spec-workstream-atlas.access-identity.workspace)    |

## Affordances

| Affordance          | Kind    | Target                                                                                                      |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| Inspect contributor | inspect | Observed Contributor                                                                                        |
| Invite contributor  | opens   | [[spec-workstream-atlas.access-identity.workspace.invite-person-to-workspace\|Invite Person To Workspace]] |
| Open member         | opens   | [[spec-workstream-atlas.access-identity.workspace.manage-membership\|Manage Membership]]                   |

## Outcomes

| Outcome                         | Meaning                                   |
| ------------------------------- | ----------------------------------------- |
| Candidate selected for invite   | Continues with the invitation Interaction |
| Existing access inspected       | No membership mutation is required        |
| Review completed without action | The Workspace remains unchanged           |
```

The first parser may keep `scope` as an authored structured field while reading the remaining
sections from conventional tables, following the Entity and Operation experiments. The source
Markdown remains authoritative.

### Composition and continuation

An Interaction may reference another Interaction from an affordance or step. It does not need a
`mode: composite` discriminator. A parent with child Interactions renders a higher-level activity
flow; selecting a child opens its own anatomy.

Connections should initially use only the semantics already available:

1. `opens`: an affordance enters another Interaction;
2. `invokes`: an affordance or step invokes an Operation;
3. `presents`: the Interaction exposes an Entity, Selection, projection, or derived value;
4. `continuesWith`: an outcome makes another Interaction the next actor-facing context.

An outcome label is not automatically a first-class Event. Durable state and Operation
applicability may be the actual continuation boundary. Atlas should only reify Event later if
producer, payload, delivery, persistence, or consumer semantics require it.

### Ontahí mapping

```text
Atlas Interaction element       Ontahí / implementation counterpart
-----------------------------   ------------------------------------
scope                           bound Entity selection / authority context
presents                        Graph Query, Selection, View, derived projection
affordance invokes Operation    Ontahí Operation invocation
Operation reference             native Operation contract
external stimulus               ingress that resolves an invocation
outcome                         Operation result or observed durable state
realization                     React/component/route integration, later
```

Interaction remains valuable even when no single Ontahí object owns the whole flow. It preserves
the actor's goal across several runtimes, pauses, reads, ingresses, and Operations. A later
experiment may find that a subset maps naturally to a Durable Operation; v0 must not assume that
mapping in advance.

### Projection lenses

Interaction source remains authoritative while Atlas derives coordinated Graph and Blueprint
lenses from one semantic projection. Graph is the default spatial reading of moments, contextual
branches, decisions, outcomes, and attached supporting behavior. Blueprint aligns the same moments
as columns with actor interaction, system behavior, rules and validation, and external systems as
rows. Both lenses select the same moment and open the same semantic inspector.

`Play` remains a later generated traversal for validating the model. It is not part of the first
slice and must not turn a default generated realization into prescribed product UI.

The first running checkpoint keeps Graph as the primary experience. Blueprint and Anatomy remain
secondary comparison lenses: Blueprint tests whether aligned actor, system, rule, and external
responsibilities reveal information missing from Graph; Anatomy exposes the authored contract with
minimal projection. Later concrete Interactions should decide whether those distinctions deserve
separate views or belong in Graph's inspector.

### Activity semantic model

The durable architecture separates authoring syntax, semantic meaning, validation, and
presentation:

```text
Interaction Markdown
  fenced YAML activity block
          |
          v
YAML adapter using the maintained `yaml` package
          |
          v
ActivityGraph semantic model
  nodes + transitions + context bindings + references
          |
          v
semantic validation and Atlas reference resolution
          |
          +--> Graph lens
          +--> Blueprint lens
          +--> later Play lens
          +--> optional Mermaid import/export
```

The semantic model belongs in the model layer and must not depend on Markdown tables, YAML node
shapes, React, Mermaid, or layout coordinates. The Markdown adapter parses one authoring form into
that model. Lens projectors consume only the normalized model. React renders lens projections rather
than interpreting source syntax. This boundary lets Atlas add a compact language or visual editor
later without replacing the model or its tests.

The first model stays deliberately small:

```ts
type ActivityNodeKind =
  | 'stimulus'
  | 'activity'
  | 'decision'
  | 'merge'
  | 'operation'
  | 'interaction'
  | 'outcome';

type ActivityNode = {
  id: string;
  kind: ActivityNodeKind;
  label: string;
  actor?: string;
  responsibility?: 'actor' | 'system' | 'external';
  reads?: SemanticReference[];
  presents?: SemanticReference[];
  invokes?: SemanticReference;
};

type ActivityTransition = {
  from: string;
  to: string;
  guard?: string;
  trigger?: string;
  affordance?: string;
  result?: string;
};

type ActivityGraph = {
  entry: string;
  nodes: ActivityNode[];
  transitions: ActivityTransition[];
};
```

The distinctions are semantic rather than visual:

1. a `guard` explains why the system permits a path;
2. an `affordance` explains what the actor can attempt;
3. a `trigger` explains which external or internal occurrence advances the flow;
4. `reads` and `presents` bind behavior to Entity state or derived context;
5. `operation` and `interaction` nodes reference independently authored contracts rather than
   copying them;
6. a local node remains part of its owning Interaction until reuse, ownership, contract, or evidence
   pressure justifies an independent Atlas Item.

The first authoring syntax is explicit YAML because it is easy to inspect, parse, validate, and
migrate:

```yaml
activity:
  entry: open-invitation
  nodes:
    open-invitation:
      kind: stimulus
      actor: invitation-recipient
      label: Open invitation URL
    lifecycle:
      kind: decision
      label: Invitation allows response
      reads:
        - WorkspaceInvitation.status
        - WorkspaceInvitation.expiresAt
    claim:
      kind: operation
      ref: WorkspaceInvitation.claim
  transitions:
    - from: open-invitation
      to: lifecycle
    - from: lifecycle
      to: invitation-unavailable
      guard: invitation is not pending
    - from: lifecycle
      to: claim
      guard: invitation is claimable
```

YAML is an authoring adapter, not the public semantic API. The adapter should use `yaml`'s parser and
document diagnostics rather than manual indentation, quoting, scalar, or collection handling. A
later compact language, visual editor, or Mermaid importer must compile to the same `ActivityGraph`.

## Execution Slices

### Slice 0 — Item Kind extension surface

- [x] Keep one canonical authored-kind catalog instead of repeating kind unions and guards.
- [x] Give kinds with distinct anatomy a typed semantic-model parser contract.
- [x] Give the viewer a presentation contract for visual role, detail extensions, and evolution
      behavior without importing React into the model layer.
- [x] Migrate Package and Entity through those contracts before adding Interaction.
- [x] Keep simple Markdown kinds on the default path without requiring empty registrations.

### Slice 1 — durable model and exemplar

- [x] Define Interaction Model v0 as a durable Atlas Item.
- [x] Record `Review Discovered Contributors` as the guiding authored example in this plan.
- [x] Author the exemplar as a repository Item only after its field names survive the first parser
      and rendering spike.
- [x] Link the Interaction model from Atlas Item Type and the Workspace model.

### Slice 2 — parsing and snapshot

- [x] Recognize `kind: interaction` without treating it as temporal evolution.
- [x] Preserve structured scope, actors, presented information, affordances, steps, and outcomes in
      the semantic snapshot.
- [x] Resolve Operation and Interaction references without copying their contracts.
- [x] Report unresolved references in the semantic model rather than silently dropping them.

### Slice 3 — detail surface

- [x] Render Goal, Actors, Context, Presents, Affordances, and Outcomes as Interaction-specific
      anatomy.
- [x] Link presented Entities/projections and invoked Operations.
- [x] Distinguish inspect, opens, invokes, and continues-with affordances visually.
- [x] Keep source Markdown available as the authoritative definition.

### Slice 4 — composed activity view

- [x] Introduce one shared lens projection for interaction moments, contextual branches, outcomes,
      and inspector detail.
- [x] Render Graph as the default Interaction lens, keeping the actor path primary and supporting
      system behavior attached to its moment.
- [x] Render Blueprint as a secondary textual lens with whitespace and subtle row separators rather
      than a visually dominant table grid.
- [x] Keep lens selection, semantic selection, and inspector content coordinated without duplicating
      model derivation in the React components.
- [ ] Render a high-level activity diagram for a parent Interaction through the Graph lens.
- [ ] Let a user open a child Interaction from the diagram and return to the parent context.
- [ ] Show branches and multiple outcomes without inventing Event Items.
- [x] Validate the first local slice against `Respond To Workspace Invitation`, including the three
      contextual identity-proof branches and the accept/decline decision.
- [ ] Compare Graph and Blueprint readings in the running application; retain both only while each
      exposes distinct useful information.
- [x] Record `Play` as a follow-up lens without implementing generated screens in this slice.

### Slice 5 — semantic Activity Graph

- [x] Define pure Activity Graph types in the model layer without Markdown, YAML, React, Mermaid, or
      layout dependencies.
- [x] Parse an optional fenced YAML activity block through the existing `yaml` dependency in a
      dedicated Markdown adapter; do not hand-parse YAML.
- [x] Keep the existing Interaction tables compatible while the activity block is optional and the
      first exemplars evolve.
- [x] Validate duplicate node IDs, missing entry nodes, dangling transitions, invalid node-kind
      fields, unresolved semantic references, and unreachable authored nodes with attributable
      diagnostics.
- [x] Resolve Entity, Operation, and child Interaction references after parsing rather than inside
      the YAML adapter.
- [x] Unit-test the semantic model independently, parser success and diagnostics independently,
      reference resolution independently, and lens projection independently.
- [ ] Prove that a second authoring adapter or a programmatically constructed graph produces the same
      normalized model and lens projections.
- [x] Expand a local activity node in place and return to its parent Interaction without promoting
      that node to an Atlas Item.
- [ ] Treat Mermaid only as an optional derived export or import experiment; no Atlas behavior may
      depend on Mermaid layout or generated markup.

### Slice 6 — implementation contrast

- [ ] Map the existing Workspace Settings contributor section to the exemplar by hand.
- [ ] Record which React components, Graph Queries, selections, and Operations currently realize
      each part.
- [ ] Identify missing product behavior separately from missing implementation bindings.
- [ ] Decide whether `realizedBy` belongs in Interaction v1 or in implementation evidence.

`Configure Workspace Model Connection` in Plan 158 is the second exemplar and first
design-before-realization experiment. Its Service Blueprint aligns actor action and visible
evidence with Operations, confidential ingress, Entity state, Resources, external systems,
failures, compensation, and telemetry. The experiment should determine whether this is a distinct
useful projection and which links belong in the semantic model rather than copying implementation
details into the Interaction.

### Slice 7 — cross-domain validation and Workspace membership adoption

- [x] Model Manage Contributors as a composed Workspace-scoped Interaction.
- [x] Model invitation paths for a known Atlas User, observed GitHub identity, and verified email.
- [x] Keep identity proof, invitation claim, and invitation acceptance as separate Operation
      responsibilities.
- [ ] Model Workspace Source import far enough to pressure asynchronous progress, webhook stimuli,
      cancellation, retry, and completion without adding unsupported primitives in advance.
- [ ] Model Workspace model-connection configuration far enough to pressure secret ingress,
      external validation, failure, and compensation boundaries.
- [ ] Record which additional Activity Graph primitives are justified by at least one exemplar and
      which remain projection-only concepts.
- [ ] Use the model to shape the first end-to-end invitation implementation plan.

## Verification

1. The exemplar remains understandable without knowing its current route or React component.
2. The same Interaction can plausibly be realized in Settings, the graph, or another surface
   without rewriting its goal, presented information, or affordances.
3. Every mutating affordance references an Operation rather than restating its contract.
4. Read-only perception and navigation remain expressible without inventing fake Operations.
5. Scope binds the Interaction to one Workspace without using parenthood for two meanings.
6. A composed diagram can navigate to child Interactions and back.
7. Missing Operations, selections, or ingresses become visible gaps in the model.
8. Interaction Items stay out of temporal Evolution and remain visible through graph and Context.
9. Focused parser, snapshot, reference-resolution, and viewer tests cover the exemplar.
10. `pnpm verify` passes for application changes.

## Decisions

1. Interaction earns first-class Item status because it has distinct actor-facing anatomy that
   Entity and Operation do not preserve.
2. Interaction is not a screen, route, component, wireframe, or runtime workflow.
3. Scope and parent are separate: scope binds domain context; parent expresses composition.
4. Composition is recursive and uniform; v0 has no atomic/composite discriminator.
5. Presents is first-class anatomy because perception is meaningful product behavior even when no
   mutation occurs.
6. Affordances may inspect, navigate, open another Interaction, or invoke an Operation.
7. Operation contracts remain authoritative for applicability, authorization, inputs, effects,
   failures, and invariants.
8. Outcomes are local Interaction structure, not automatically Event Items.
9. UI realization metadata is optional and deferred until the exemplar proves what evidence is
   useful.
10. The first exemplar uses existing behavior to keep the model accountable to a real product.
11. Interaction must enter through a small Item Kind extension surface. Semantic parsing and UI
    presentation use separate static registries; Atlas does not need runtime plugins or one
    universal registry in v0.
12. A specialized kind owns a typed model payload rather than adding another optional field to the
    generic snapshot node. Kinds without specialized anatomy keep the default Markdown path.
13. Activity Graph is a renderer-independent semantic model. YAML is its first authoring adapter;
    Graph, Blueprint, later Play, and optional Mermaid interoperability are projections or adapters.
14. Guards, triggers, affordances, Entity reads, and Operation references remain distinct even when
    a diagram chooses a compact edge label for several of them.
15. New activity semantics require exemplar pressure. The implementation must not recreate BPMN,
    workflow execution, or a custom language before the current minimal graph proves insufficient.
16. The existing `yaml` dependency is the parser boundary for the first form; Atlas will not own a
    bespoke YAML parser.

## Open Questions

1. Should scope bind an Entity type, an Entity selection, a named graph context, or a more general
   semantic boundary?
2. Which presented values should reference Entity Views or Selections versus descriptive concepts?
3. Does `continuesWith` need an explicit outcome binding, or can the first diagram infer it from
   ordered steps and affordances?
4. How should actor identity relate to Operation authority without duplicating authorization rules?
5. Are abandoned and unavailable outcomes always worth authoring, or only when they change product
   behavior?
6. Should parent-child containment and explicit Interaction references both appear in graph
   topology?
7. When an Interaction maps closely to an Ontahí Durable Operation, is that a realization link,
   implementation evidence, or a stronger semantic type relationship?
8. Can Atlas eventually produce a Wizard-of-Oz runtime from Presents and Affordances without
   prematurely treating generated UI as product design?

## Closure / Evolution

This plan starts with the model and one manual exemplar. The first implementation checkpoint should
prove that Atlas can preserve and render the interaction independently of its current Settings
realization. Workspace invitation and membership workflows are the next adoption pressure, not the
initial parser scope.

The production exemplar exposed two compatibility edges after the first detail-surface deployment:
an older Projection Revision could still label the Item as `capability`, and the generic Markdown
fallback rejected Context's valid one-column table. The deployment reconciliation remains
responsible for recompiling the first edge; the viewer now accepts the authored one-column form so
the fallback stays legible while convergence happens.

The exemplar also proves unresolved semantic references as useful project evidence. Its invitation
and membership affordances now target the intended child Interactions before those Items exist;
Atlas renders them as not-defined shaping gaps while keeping the Workspace presentation reference
navigable. Missing workflow pieces therefore remain explicit without manufacturing empty ontology.

The affordance presentation distinguishes the actor-facing action from its semantic target. An
unlinked target such as `Observed Contributor` remains descriptive context and is not styled as a
control. Only an explicitly authored semantic link participates in resolution and can become either
navigable or a not-defined shaping gap; Atlas does not infer missing ontology from capitalized prose.

The first authored composition places `Review Discovered Contributors` beneath the
Workspace-scoped `Manage Contributors` Interaction. The parent preserves the actor's complete
administration goal while its defined and not-yet-defined children expose the current product
boundary: contributor review exists, whereas invitation and membership management remain explicit
shaping gaps. Composition therefore uses ordinary Interaction parenthood rather than introducing a
separate composite kind.

The first executable Activity Graph checkpoint introduces pure normalized nodes and transitions,
an explicit `atlas-activity` YAML adapter, structural validation, and an authored
`Respond To Workspace Invitation` graph. The existing anatomy tables remain compatible and
authoritative for their current detail surfaces. Atlas reference resolution and Graph/Blueprint
projection over the new model remain separate subsequent checkpoints; parser code neither resolves
Items nor imports viewer concerns.

The next checkpoint resolves every Activity semantic reference only after all source records are
known, preserving unresolved Items as attributable diagnostics. A renderer-independent lens
projection attaches adjacency, detects cyclic back-transitions, and derives columns without adding
coordinates to the semantic model. The Graph lens now consumes that projection, keeps legacy
table-derived flows as a fallback, and opens local node detail in place with navigable Entity,
Operation, and Interaction references.

`Invite Person To Workspace` now defines the owner's side of invitation creation across three
recipient paths: a stable Atlas User, an observed GitHub identity, or verified-email delivery. The
paths converge only on pending invitation intent. Recipient response remains a separate unresolved
Interaction, while create, claim, and accept remain separate unresolved Operation responsibilities.
This prevents provider or email matching from silently becoming account linking or Membership.

`Respond To Workspace Invitation` defines the recipient side against one invitation-scoped
boundary. Authentication and identity proof enter as stimuli; claim binds the proven invitation to
the authenticated User without granting access; accept creates Membership; decline closes the
invitation without Membership. Expiry and owner revocation remain observed lifecycle changes rather
than recipient affordances. The interaction therefore preserves the boundary between transport,
identity proof, durable invitation state, and access mutation before implementation begins.

The plan should remain current until the exemplar renders end to end and the team decides whether
realization bindings belong in Interaction v1. Runtime execution, UI generation, and Ontahí Durable
Operation convergence should be extracted into focused follow-ups only after evidence from the v0
model exists.
