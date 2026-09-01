---
id: spec-workstream-atlas.operating-practice.shape-transformation-loop
kind: practice
title: Shape Transformation Loop
parent: spec-workstream-atlas.operating-practice
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.operating-principles.development-as-shape-transformation
  - spec-workstream-atlas.atlas-model.current-system-form
  - spec-workstream-atlas.atlas-model.form-transformation
  - spec-workstream-atlas.atlas-model.reconciliation
  - spec-workstream-atlas.atlas-model.work-item
  - spec-workstream-atlas.atlas-model.evidence-binding
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
  - plans/backlog/105-atlas-shaping.md
  - plans/next/106-atlas-plan-reconciliation-operation.md
---

[[spec-workstream-atlas.operating-practice.shape-transformation-loop|Shape Transformation Loop]] is the operating practice that turns the principle into a repeatable development method.

It behaves like a template method whose holes can be filled manually, by a chat assistant, by an Atlas UI operation, by a repo-aware agent, or by a GitHub-triggered durable operation:

1. observe the current system form,
2. name the tension, opportunity, missing abstraction, or drift,
3. select or create a work item,
4. propose the intended form transformation,
5. execute the material change in code, source, docs, data, or configuration,
6. reconcile the work item against what actually happened,
7. update the atlas model,
8. bind evidence,
9. leave follow-up work or future signals.

The first Atlas versions can keep most holes human-filled. The important step is that Atlas names the loop, shows where a selected item sits inside it, and gradually makes each hole executable.
