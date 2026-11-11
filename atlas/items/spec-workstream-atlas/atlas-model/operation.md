---
id: spec-workstream-atlas.atlas-model.operation
kind: concept
title: Operation
parent: spec-workstream-atlas.atlas-model.item-type
status: shaping
horizon: now
relatedPlans:
  - plans/current/146-package-manifest-and-classroom-model.md
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
their full definitions.

## Progressive Contract

An Operation Item does not need every section on its first appearance. It earns reification when
the behavior needs independent navigation, richer inputs or results, failure semantics, authority,
implementation evidence, or evolution. The receiver may retain a compact linked row as an index;
the detailed contract belongs to the Operation Item.
