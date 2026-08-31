# 108. Atlas Item Type Model

Status: shaping

## Summary

Generalize the plan-model work into a typed model of Atlas items.

The insight from `Plan` is broader than plans: different Atlas item types have different anatomy, relationships, evidence, and operations. A plan can be reviewed, closed, reconciled, and split into follow-ups. A book, entity, experience, capability, or practice needs different questions and different operations.

## Context

Plan 107 started by asking what a [[spec-workstream-atlas.atlas-model.plan|Plan]] is. While shaping it, we saw that the same problem exists for every Atlas item type.

Atlas currently treats many things as nodes with a `kind`, but the product model wants more than labels. Item types should explain what information matters for that type and what operations make sense on it.

For example:

```txt
Plan
  can be reviewed, reshaped, closed, reconciled, split into follow-ups

Book
  can define invariants, relations, experiences, operations, evidence, and evolution

Experience
  can define user goals, flows, states, affordances, evidence, and open tensions
```

## Research / Evidence

1. `plans/next/107-plan-model-research-and-v0.md` defined `Plan` anatomy and exposed the need for type-specific operations.
2. BookOps concepts such as Book, Paragraph, Collaborator, Conversation, Invitation, and Translation need durable product-level descriptions that sit above code entities.
3. Ontahi concepts such as Entity, Domain Operation, Authority, Policy, and Durable Operation already pressure Atlas toward a model-centered vocabulary.
4. The current graph gets visually useful only when nodes carry enough semantics to support filtering, board views, detail panels, and guided operations.

## Scope

This plan defines the broader item-type model that will contain the `Plan` model work.

It should identify which Atlas item types deserve first-class anatomy and operations, then work through a few contrasting examples before broad backfill.

## Non-Goals

1. Do not define the final taxonomy of all possible item types yet.
2. Do not migrate all existing atlas items or plans.
3. Do not force Ontahi's lower-level entity model directly into Atlas. Atlas stays product/system-management level.
4. Do not make `item` or `node` the product language. Those remain implementation terms.

## Proposed Form

```txt
Atlas Item
  Atlas Item Type
    Work Item
      Plan
    Model Item
      Entity / Book / Domain Operation
    Experience
      Reader Experience / Sharing And Collaboration
    Capability
      Translation / Invitations / Storybook Bindings
    Practice
      Archaeological Reading / Backfill Strategy
```

An item type should describe:

1. what information belongs on that type,
2. what relationships are meaningful for that type,
3. what operations can be run against that type,
4. what evidence can prove its state,
5. how it evolves over time.

## Execution Slices

1. Create a parent plan and atlas item for Atlas Item Type.
2. Reframe `plans/next/107-plan-model-research-and-v0.md` as the first worked example under this broader plan.
3. Define a v0 anatomy for `Plan`, `Book`, and one `Experience` as contrasting examples.
4. Compare those examples against existing Atlas kinds and remove or demote kinds that do not earn distinct anatomy or operations.
5. Decide how type anatomy should be represented: markdown sections, frontmatter, structured source, or an Ontahi-backed adapter.

## Verification

This plan is useful if the Atlas UI can eventually render different detail surfaces for different item types instead of one generic node detail view.

It should also make assisted editing more concrete: the assistant can choose operations based on the selected item type rather than treating every node as free text.

## Decisions

1. `Atlas Item` is the current product-language noun; `node` is the graph/UI implementation word.
2. `Work Item` is not the generic atlas node; it is the subset of atlas items that represent temporal work.
3. `Shape` stays a verb: plans, operations, and practices shape atlas items over time.
4. Item types should earn first-class status by having distinct anatomy or operations.
5. `Plan` remains the first worked example, but it is now child work under Atlas Item Type.
6. Atlas should learn from Ontahi without collapsing into Ontahi's lower-level implementation model.

## Open Questions

1. Which item types are first-class and which are merely tags, states, views, or relations?
2. How should Atlas express operations for an item type before those operations are implemented in Ontahi?
3. Should the UI render type-specific sections from markdown conventions first, or wait for structured source?
4. How do item-type operations relate to assisted editing and automated re-shaping?

## Child Plans

1. [107. Plan Model Research And v0](./107-plan-model-research-and-v0.md)
2. [109. Work Item Impact Surface](./109-work-item-impact-surface.md)
3. [115. Atlas Definition Level Axis](../backlog/115-atlas-definition-level-axis.md)

## Closure / Evolution

Not closed. This plan is intentionally in shaping mode; more child plans should emerge as we work through other item types.
