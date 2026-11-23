---
id: spec-workstream-atlas.atlas-model.operation
kind: concept
title: Operation
parent: spec-workstream-atlas.atlas-model.item-type
status: shaping
horizon: now
relatedPlans:
  - plans/current/146-package-manifest-and-classroom-model.md
  - plans/current/156-entity-behavior-lenses-spike.md
exemplars:
  - ontahi.examples.classroom.enrollment-invitation.accept
  - ontahi.model.domain-operation
---

An Operation is a durable Atlas Item describing one behavior that may be invoked against a domain
receiver. It explains the behavior's meaning and contract without requiring Atlas Markdown to be
executable framework code. A runtime such as Ontahí may implement or interpret the same semantics
through its own native model.

## Operation Model v0

### Receiver

The Entity or other domain Item whose behavior is being invoked.

### Actor

The authority role attempting the behavior. The actor is not necessarily the receiver.

### Inputs And Output

Values required to decide and execute the behavior, and the domain result returned on success.

### Availability

Receiver state and domain predicates that must hold before invocation.

### Transition And Effects

The receiver state change, if any, and domain effects produced after availability is established.

### Failures

Named domain outcomes for rejected or unsuccessful invocation. Infrastructure exceptions do not
become domain failures merely because an implementation can throw them.

### Invariants Preserved

Receiver invariants the Operation must preserve. The Operation references them instead of copying
their full definitions. Each authored rule name resolves inside the receiver Entity's invariant
scope. Atlas normalizes that edge as `<entity-id>#invariant:<rule>` and retains unresolved edges as
explicit shaping gaps rather than silently treating arbitrary prose as a declaration.

### Realization References

An Operation may name typed implementation targets without turning its domain identity into a
framework symbol. The authoring form is structured so Atlas does not need to parse meaning out of
free text:

```yaml
realizationRefs:
  - namespace: ontahi
    kind: operation
    target: AtlasWorkspace.invite
    status: planned
```

`namespace` selects a resolver and vocabulary, `kind` selects the target type within that
namespace, and `target` is the namespace-owned locator. `status` records whether the binding is
planned, active, or retired; it is not proof that implementation exists. The normalized triple can
later acquire a compact spelling such as `ontahi::operation/AtlasWorkspace.invite`, but that syntax
must compile into this structure rather than become a second semantic model.

The relationship is deliberately indirect for an Interaction:

```text
local activity node -> Atlas Operation -> realization reference
```

This keeps product behavior portable while allowing one Operation to acquire Ontahí, ingress, UI,
or other realization references over time. A namespace does not imply repository ownership: it
identifies the resolver and target language. Cross-repository Atlas Items continue to use canonical
source URIs such as `ontahi://...`.

## Progressive Contract

An Operation Item does not need every section on its first appearance. It earns reification when
the behavior needs independent navigation, richer inputs or results, failure semantics, authority,
implementation evidence, or evolution. The receiver may retain a compact linked row as an index;
the detailed contract belongs to the Operation Item.

## Derived Programmer Lens

Atlas may project the typed Operation contract as compact semantic pseudocode. The projection names
receiver, actor, inputs, availability, transition, effects, failures, and preserved invariants, but
does not pretend to be executable TypeScript or framework code. It is another reading of the same
contract, not a second authoring source.

Host-language and repository realization links remain separate evidence. They may later enrich the
programmer lens, but the first spike deliberately stops at domain pseudocode.
