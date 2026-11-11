---
id: spec-workstream-atlas.atlas-model.item-type
kind: concept
title: Atlas Item Type
parent: spec-workstream-atlas.atlas-model.item
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model
  - spec-workstream-atlas.atlas-model.item
  - spec-workstream-atlas.assisted-editing
relatedPlans:
  - plans/next/108-atlas-item-type-model.md
  - plans/done/107-plan-model-research-and-v0.md
  - plans/current/146-package-manifest-and-classroom-model.md
exemplars:
  - spec-workstream-atlas.atlas-model.plan
  - spec-workstream-atlas.atlas-model.package
  - spec-workstream-atlas.atlas-model.entity
  - spec-workstream-atlas.atlas-model.operation
  - ontahi.examples.classroom.enrollment-invitation
  - bookops.model.book
  - bookops.reader-experience
  - ontahi.model.domain-operation
---

[[spec-workstream-atlas.atlas-model.item-type|Atlas Item Type]] is the part of the Atlas model that asks what information, relationships, evidence, and operations belong to each kind of [[spec-workstream-atlas.atlas-model.item|Atlas Item]].

The goal is not to make every item look like a plan. The goal is the opposite: make it clear why a Plan, Book, Experience, Capability, Principle, Practice, Entity, or Operation needs a different detail surface and different operations.

An item type should earn first-class status by having at least one of these:

1. distinct anatomy,
2. distinct operations,
3. distinct evidence,
4. distinct lifecycle or evolution behavior.

`Plan` is the first worked example because it already exposes operations such as review state, close, reconcile, extract follow-ups, and reshape. The next passes should contrast it with a product/model item such as Book and an experience item such as Reader Experience or Sharing And Collaboration.

`Package` is the second concrete boundary: unlike a repository Source or a temporal Plan, it owns a
local semantic namespace and implementation surface. The Classroom Package then supplies the first
external-domain `Entity` experiment through Enrollment Invitation. Its behavior model will test
typed Operations, applicability, authority, effects, invariants, and derived interaction views
without first describing Atlas's own collaboration domain recursively.

`Entity` begins with one authoring anatomy: Data, Relations, States, Operations, and Invariants.
Operations declare availability as `Actor + Applies when`, allowing Atlas to derive temporal and
interaction views without making a statechart or screen flow another source of truth.

`Operation` is the next worked anatomy. It reifies behavior that outgrows an inline Entity row and
gives receiver, actor, inputs, output, availability, transitions, effects, failures, and preserved
invariants an independently navigable home.
