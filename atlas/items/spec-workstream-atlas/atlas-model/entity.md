---
id: spec-workstream-atlas.atlas-model.entity
kind: concept
title: Entity
parent: spec-workstream-atlas.atlas-model.item-type
status: shaping
horizon: now
relatedPlans:
  - plans/current/146-package-manifest-and-classroom-model.md
exemplars:
  - ontahi.examples.classroom.user
  - ontahi.examples.classroom.classroom
  - ontahi.examples.classroom.enrollment
  - ontahi.examples.classroom.enrollment-invitation
---

An Entity is a durable Atlas Item whose identity, data, relations, state, operations, and invariants
describe one domain concept across time. It is not merely a database record or a TypeScript type:
its anatomy explains what the concept knows, how it relates to other Items, and which state changes
the system admits.

## Entity Model v0

An Entity may use five canonical Markdown sections. Their tables are authoring syntax for a typed
`EntityModel` in the Atlas snapshot. Atlas derives dedicated projections from that model without
requiring authors to maintain a separate diagram or interaction model.

### Data

| Column | Meaning |
| --- | --- |
| `Field` | Stable field name inside the Entity |
| `Type` | Scalar, value type, enum, or reference-shaped value |
| `Required` | Whether every valid instance carries the value |
| `Meaning` | Domain responsibility rather than storage detail |

### Relations

| Column | Meaning |
| --- | --- |
| `Relation` | Stable relation name |
| `Target` | Related Entity or identity concept |
| `Cardinality` | Expected cardinality such as `one` or `many` |
| `Meaning` | Role played by the target in this Entity |

### States

| Column | Meaning |
| --- | --- |
| `State` | Stable state name |
| `Kind` | `initial`, `active`, or `terminal` |
| `Meaning` | Domain interpretation of the state |

### Operations

| Column | Meaning |
| --- | --- |
| `Operation` | Stable behavior name; it may later become its own Operation Item |
| `Actor` | Authority role attempting the behavior |
| `Applies when` | State and domain predicate that make the behavior available |
| `Transition` | Source and target state, or `none` for a non-state-changing behavior |
| `Effects` | Domain effects produced after the preconditions hold |

`Actor + Applies when` is the operation-availability rule. A statechart groups the same declarations
by transition; an interaction model groups them by actor and context. Both are derived views rather
than second sources of truth.

## Derived Behavior Views

Atlas parses the five tables at reconciliation time. Entity detail may then render:

1. a statechart from States and Operation transitions;
2. an availability matrix from Operation actor and applicability declarations;
3. later interaction or authorization views from the same typed facts.

An invalid or absent canonical table produces no derived rows; it must not silently invent domain
behavior from prose. The original Markdown remains available as evidence and for progressive
shaping.

### Invariants

| Column | Meaning |
| --- | --- |
| `Rule` | Stable identifier suitable for discussion and later validation |
| `Constraint` | Condition that every valid state transition must preserve |

## Progressive Reification

An operation may begin as a row while the Entity is being shaped. It should become a standalone
Operation Item when it needs its own inputs, outputs, failure model, authority policy, effects,
implementation evidence, or evolution history. The Entity keeps the relationship to that Item; it
does not duplicate the detailed contract.
