---
id: spec-workstream-atlas.atlas-model.model-item
kind: concept
title: Model Item
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
  - plans/backlog/105-atlas-shaping.md
exemplars:
  - spec-workstream-atlas.atlas-model.item
  - spec-workstream-atlas.atlas-model.work-item
  - spec-workstream-atlas.atlas-model.plan
  - spec-workstream-atlas.atlas-model.evidence-binding
  - bookops.model.book
  - bookops.model.collaborator
  - bookops.model.paragraph
  - ontahi.model.entity
  - ontahi.model.domain-operation
  - ontahi.model.authority
---

A [[spec-workstream-atlas.atlas-model.model-item|Model Item]] is the current source/parser term for a durable concept a system needs to keep naming across plans, code, product decisions, and evidence.

The product-language term is [[spec-workstream-atlas.atlas-model.item|Atlas Item]].

The atlas gives each shape a stable place so later work can refine the idea instead of rediscovering it from scattered plan text.

In Workstream Atlas, examples include Plan, Evidence Binding, Relation Model, State Axis, and Operating Practice.

In BookOps, examples include Book, Collaborator, Paragraph, Invitation, Conversation, and Translation.

In Ontahi, examples include Entity, Domain Operation, Authority, Policy, and Unit Of Work.

A model item is not necessarily a persisted entity. It can be a role, operation, artifact, policy, state, practice, experience, or product concept. The useful test is whether repeated plans need a shared name for it.

Plans can mention model items before they are formalized. A repeated mention can later be promoted into an explicit atlas item. The `exemplars` field may point to already materialized atlas items or to latent ids that should become clickable once those items are created.
