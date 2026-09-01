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
exemplars:
  - spec-workstream-atlas.atlas-model.plan
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
