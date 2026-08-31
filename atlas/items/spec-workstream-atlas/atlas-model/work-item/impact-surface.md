---
id: spec-workstream-atlas.atlas-model.work-item.impact-surface
kind: concept
title: Work Item Impact Surface
parent: spec-workstream-atlas.atlas-model.work-item
status: idea
horizon: next
supports:
  - spec-workstream-atlas.atlas-model.work-item
  - spec-workstream-atlas.atlas-model.relation-model
relatedPlans:
  - plans/next/109-work-item-impact-surface.md
---

Work Item Impact Surface is the part of a work item that names what the work shapes, affects, preserves, breaks, or restores.

It keeps small operational tasks and larger spec-driven plans connected to the same Atlas model without pretending they have the same anatomy.

## Relation Lens

1. `shapes`: gives durable form to an Atlas item or revises that form.
2. `affects`: touches or pressures an Atlas item without necessarily defining it.
3. `preserves`: protects an invariant while nearby work changes.
4. `breaks`: knowingly breaks, risks breaking, or exposes a broken invariant.
5. `restores`: repairs an invariant that was missing, stale, or broken.

## Example

A plan can shape an experience while affecting several entities and preserving an invariant. A task can affect deployment configuration while restoring a runtime guarantee.
