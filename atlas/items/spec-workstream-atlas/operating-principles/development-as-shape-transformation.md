---
id: spec-workstream-atlas.operating-principles.development-as-shape-transformation
kind: principle
title: Development As Shape Transformation
parent: spec-workstream-atlas.operating-principles
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model.current-system-form
  - spec-workstream-atlas.atlas-model.form-transformation
  - spec-workstream-atlas.atlas-model.reconciliation
  - spec-workstream-atlas.atlas-model.item
  - spec-workstream-atlas.atlas-model.work-item
  - spec-workstream-atlas.atlas-model.plan
  - spec-workstream-atlas.atlas-model.evidence-binding
  - spec-workstream-atlas.atlas-experiences.atlas-shaping
  - spec-workstream-atlas.atlas-experiences.history-and-evolution
  - spec-workstream-atlas.operating-practice
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
  - plans/next/105-atlas-shaping.md
  - plans/next/107-plan-model-research-and-v0.md
  - plans/next/108-atlas-item-type-model.md
---

[[spec-workstream-atlas.operating-principles.development-as-shape-transformation|Development As Shape Transformation]] is the frame that treats development as repeated changes to a system's current conceptual form.

Before Atlas, the main loop was chat plus code. Plans appeared as a way to pause, design, communicate intent, and leave a durable memory of why a change should exist. Status folders, plan numbers, and sub-plan suffixes added a first rough structure, but the filesystem still could not show how ideas became models, experiences, capabilities, operations, invariants, and evidence.

Atlas adds a living layer between plans and code:

1. the [[spec-workstream-atlas.atlas-model.current-system-form|Current System Form]]: what exists, what it means, what it enables, and what constraints it carries,
2. [[spec-workstream-atlas.atlas-model.work-item|Work Items]] that read that form and propose interventions over it,
3. [[spec-workstream-atlas.atlas-model.evidence-binding|Implementation Evidence]] that proves which parts of the form are only intention, which are implemented, and which are validated.

A [[spec-workstream-atlas.atlas-model.plan|Plan]] is therefore not the durable system model. It is an intervention over the model. It observes the current system form, names a pressure or opportunity, proposes a [[spec-workstream-atlas.atlas-model.form-transformation|Form Transformation]], guides implementation, and later becomes history after [[spec-workstream-atlas.atlas-model.reconciliation|Reconciliation]].

The practical loop is:

1. observe the current system form,
2. identify a tension, opportunity, or missing abstraction,
3. create a work item,
4. execute the change in code or source,
5. reconcile what actually happened,
6. update the atlas item model,
7. leave evidence.

This principle shapes the Atlas product itself. Experiences such as [[spec-workstream-atlas.atlas-experiences.atlas-shaping|Atlas Shaping]], [[spec-workstream-atlas.atlas-experiences.history-and-evolution|History And Evolution]], assisted editing, and plan reconciliation should help users see and act on the [[spec-workstream-atlas.operating-practice.shape-transformation-loop|Shape Transformation Loop]] instead of forcing them to reconstruct it from old chats, code diffs, and scattered plan files.
