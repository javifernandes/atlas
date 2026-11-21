---
id: spec-workstream-atlas.atlas-model.interaction
kind: concept
title: Interaction
parent: spec-workstream-atlas.atlas-model.item-type
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model
  - spec-workstream-atlas.atlas-model.item-type
  - spec-workstream-atlas.workspace
relatedPlans:
  - plans/current/149-interaction-model-v0.md
  - plans/next/108-atlas-item-type-model.md
  - plans/current/140-workspace-sources-and-contributor-discovery.md
  - plans/current/146-package-manifest-and-classroom-model.md
---

An Interaction is a durable actor-facing description of what the system must let someone perceive
and do to reach a goal inside a semantic boundary. It preserves product intent across changes in
routes, components, controls, runtimes, and other implementation realizations.

Interaction complements rather than replaces [[spec-workstream-atlas.atlas-model.entity|Entity]]
and [[spec-workstream-atlas.atlas-model.operation|Operation]]. Entity explains durable state and
relations. Operation explains one invocable behavior contract. Interaction explains why readings,
decisions, navigation, external stimuli, and Operations belong together from an actor's point of
view.

## Interaction Model v0

### Scope

The Entity instance, selection, or semantic boundary that contextualizes the interaction. Scope is
not parenthood: an Interaction may be scoped to one Workspace while being composed under Manage
Contributors.

### Goal

The actor-facing intent that should survive changes in UI realization.

### Actors

The primary actor pursuing the goal and other participants whose visible behavior matters. Actor
labels do not duplicate Operation authorization rules.

### Context

State that must hold for the interaction to make sense or be presented. Context is broader than an
Operation's executable precondition.

### Presents

Information the actor must be able to perceive, such as Entities, selections, derived projections,
identity status, evidence, or available authority.

### Affordances

Possibilities offered to the actor. An affordance may inspect information, navigate, open another
Interaction, or invoke an Operation. Not every affordance mutates state.

### Steps

An ordered or branching reading of referenced Operations, child Interactions, and external stimuli.
Steps do not own copied Operation contracts.

### Outcomes

Meaningful completions, refusals, abandonment, or unavailable results. An outcome is not
automatically a first-class Event.

## Composition

Interaction composition is recursive. An Interaction may reference or contain other Interactions;
v0 does not distinguish atomic and composite types. A parent can render a high-level activity view,
and a child retains its own detailed anatomy and source.

The initial relationships are `presents`, `opens`, `invokes`, and `continuesWith`. They remain
relationship vocabulary rather than separate Item Types.

A semantic reference may intentionally point to an Item that has not been authored yet. Atlas
preserves that reference as unresolved and presents it as visible shaping pressure, similar to a
Wikipedia red link. It does not silently reduce the target to prose or create a placeholder Item:
the gap remains attributable to the Interaction until the referenced Entity, Operation, or child
Interaction acquires durable form.

An Affordance label describes what the actor can attempt; its Target describes what that attempt
inspects, opens, or invokes. The label is not itself a navigation control. Only an explicitly linked
Target participates in semantic resolution. Plain target text remains descriptive, preventing
Atlas from treating every noun in an Interaction as missing ontology.

Atlas renders this anatomy as a dedicated detail projection rather than repeating the source
tables. Scope and goal establish the boundary first; Actors, Context, Presents, Affordances, Steps,
and Outcomes then expose the interaction in actor-facing order. Resolved references are navigable,
while unresolved references remain visible authoring pressure. The Source view retains the
authoritative Markdown. A single-field section such as Context remains a valid one-column table in
that source and in the generic Markdown fallback; presentation must not require incidental extra
columns to recognize its structure.

## Projection Lenses

One Interaction semantic projection may support several coordinated lenses without changing the
authoritative source. The default Graph lens emphasizes the actor path through moments, contextual
forks, decisions, and outcomes. The Blueprint lens aligns the same moments with actor interaction,
system behavior, rules and validation, and external systems. Selecting a moment in either lens
opens the same inspector for Presents, Affordances, Operations, alternative exits, actor, and
supporting responsibilities.

A later Play lens may generate a navigable default realization to validate the model. That
traversal remains experimental rather than prescribing the product's final screen design.

Graph is the primary Interaction experience. Blueprint and Anatomy are provisional comparison
lenses rather than equal product modes: concrete Interaction cases should determine whether their
distinct information remains separate or is absorbed into Graph and its inspector.

## Activity Semantics

An Interaction may carry one renderer-independent Activity Graph that makes its behavior explicit
without turning the Interaction into executable workflow code. The graph separates typed local
nodes, transitions, context bindings, and semantic references from every authoring and presentation
form.

The initial local node vocabulary is `stimulus`, `activity`, `decision`, `merge`, `operation`,
`interaction`, and `outcome`. A transition may independently carry a guard, trigger, affordance, or
result. An activity may name its actor or responsibility and bind the Entity state it reads or
presents. Operation and child Interaction nodes resolve independently authored Atlas Items rather
than copying their contracts.

These are local Activity Graph elements, not new global Atlas Item Types. A node can receive a
stable local identity for selection, drill-down, comments, diagnostics, and implementation evidence
while remaining owned by its Interaction. Reuse, independent ownership, a durable contract, or
cross-Interaction evidence may later justify promotion to an Item; visual prominence alone does
not.

The first explicit authoring adapter is a fenced YAML block parsed through Atlas's maintained `yaml`
dependency. YAML is not the semantic API. A later compact language, visual editor, programmatic
builder, or Mermaid importer must compile into the same normalized Activity Graph. Graph, Blueprint,
Play, and Mermaid export consume projections of that model and never reinterpret source text or
generated SVG as semantic truth.

The implementation boundary is strict:

```text
authoring adapter -> Activity Graph -> validation / reference resolution -> lens projection -> UI
```

Each boundary remains independently unit-testable. Model code does not import Markdown, YAML,
React, Mermaid, or layout coordinates. Parsing does not resolve Atlas references. Lens projection
does not parse authoring syntax. React renders projections rather than inferring behavior from
labels.

Reference resolution runs only after Atlas knows the complete source snapshot. It resolves
absolute semantic IDs and source-relative references with the same rules as the rest of an
Interaction, preserving unresolved targets as shaping pressure. The Activity Graph lens then adds
presentation adjacency, back-transition detection, and derived columns without mutating authored
nodes or introducing layout coordinates into the durable model. Selecting a local node reveals its
responsibility, reads, presentations, and semantic target while remaining inside the owning
Interaction. Incoming and outgoing topology stays in the Graph lens rather than being duplicated
in the inspector.

The Graph lens is a spatial projection: pan, zoom, reset, and fit-to-content belong to the viewer,
not to the durable Activity Graph. Directional keyboard traversal is likewise a viewer behavior:
it selects the nearest node in the requested spatial direction through a reusable navigation
primitive that the Workspace graph may also adopt. It does not add ordering or coordinates to the
semantic model. Merge nodes appear as compact convergence points because they establish a
control-flow condition without performing actor or system work.

Graph topology belongs to connections rather than node copy. A decision node does not repeat its
successor nodes as a list, and an Operation does not repeat the Outcome already reached by its
outgoing transition. The spatial lens renders compact selectable nodes above a derived SVG
connection layer; concise guards, triggers, or affordances may label those connections while the
node inspector carries semantic detail. SVG paths and all layout coordinates remain disposable
presentation projections, never durable Activity Graph truth.

Selected-node detail stays adjacent to the spatial context in a dismissible right-hand panel. The
panel may cover part of the canvas temporarily, but it does not replace, resize, or duplicate the
graph and it owns its own vertical scrolling. Pointer and directional-key selection open the same
panel. The selected node is the visible keyboard-focus signal, so the focusable canvas does not add
a competing outline around the entire graph.

The spatial projection owns the Interaction detail subsection while it is active. It does not sit
inside a second editorial card, and wheel or pinch gestures over that surface are consumed by the
canvas for pan and zoom instead of leaking to the surrounding detail scroller. Blueprint and
Anatomy remain editorial readings and retain their own content padding.

Full Item detail is a Workspace focus surface rather than an inset modal. Opening an Item replaces
the map's working surface at viewport scale while retaining explicit return navigation and the
Item's URL state. Spatial Interaction lenses may use every remaining pixel below the compact detail
header; editorial lenses keep their own readable measure instead of imposing that padding on the
surface itself.

Workspace switching and viewer identity remain available as quiet inline chrome above a focused
Item. They do not retain card shadows, glass panels, or modal-like containers that compete with the
Item header and its lenses.

Actors are named Interaction-local bindings. Activity nodes reference those bindings rather than
copying display labels, but v0 deliberately leaves their executable resolution as descriptive
semantics. A role such as `Invitation Recipient` may later be proven through a User identity,
provider identity, or invitation secret without prematurely inventing an Atlas expression
language or Entity type for the role.

Nodes and transitions have stable local identities. They can later anchor comments,
implementation evidence, runtime traces, branch metrics, and experiment variants while remaining
owned by the Interaction. A stimulus is the semantic fact that enters the graph; an Ontahí Ingress
or external Event may realize that entry later, but transport is not part of the stimulus's
identity.

This preserves a possible execution bridge without equating the current concepts: an Interaction
describes observable actor-system behavior, Operations remain executable domain capabilities, and
durable execution may eventually interpret or report against the same Activity Graph. Whether an
Operation may also own an Activity Graph body remains exemplar-driven follow-up work.

## Implementation Boundary

Interaction is not executable framework code, a React component hierarchy, or a route map. Ontahí
Operations, Graph Queries, selections, views, and ingresses may realize its behavior. Atlas may
later preserve those bindings as evidence, but v0 first proves that the product interaction remains
useful without requiring one realization.

`Review Discovered Contributors` is the first exemplar. It is scoped to one Workspace, presents
observed participation and access state, and offers affordances that may inspect a contributor or
continue into invitation and membership Interactions. Its current Workspace Settings section is
one realization, not its identity.
