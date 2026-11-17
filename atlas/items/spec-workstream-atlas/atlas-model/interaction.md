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

Atlas renders this anatomy as a dedicated detail projection rather than repeating the source
tables. Scope and goal establish the boundary first; Actors, Context, Presents, Affordances, Steps,
and Outcomes then expose the interaction in actor-facing order. Resolved references are navigable,
while unresolved references remain visible authoring pressure. The Source view retains the
authoritative Markdown.

## Implementation Boundary

Interaction is not executable framework code, a React component hierarchy, or a route map. Ontahí
Operations, Graph Queries, selections, views, and ingresses may realize its behavior. Atlas may
later preserve those bindings as evidence, but v0 first proves that the product interaction remains
useful without requiring one realization.

`Review Discovered Contributors` is the first exemplar. It is scoped to one Workspace, presents
observed participation and access state, and offers affordances that may inspect a contributor or
continue into invitation and membership Interactions. Its current Workspace Settings section is
one realization, not its identity.
