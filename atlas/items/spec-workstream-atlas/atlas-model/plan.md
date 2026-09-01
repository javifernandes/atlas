---
id: spec-workstream-atlas.atlas-model.plan
kind: entity
title: Plan
parent: spec-workstream-atlas.atlas-model.work-item
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model
relatedPlans:
  - plans/next/108-atlas-item-type-model.md
  - plans/done/107-plan-model-research-and-v0.md
  - plans/done/110-plan-backfill-and-reconciliation.md
  - plans/next/106-atlas-plan-reconciliation-operation.md
  - plans/next/109-work-item-impact-surface.md
exemplars:
  - plans/done/07-translations-scripted.md
  - plans/done/16-extract-translate-package.md
  - plans/done/11-book-ownership-permissions.md
  - plans/done/21-feedback-conversations-no-legacy.md
  - plans/done/100-ontahi-framework-extraction.md
  - plans/done/107-plan-model-research-and-v0.md
---

A [[spec-workstream-atlas.atlas-model.plan|Plan]] is a work item that gives bounded, executable form to a possible system change.

Plans are not strategic [[spec-workstream-atlas.atlas-model.goal|Goals]] or the durable system model. They are interventions that advance Goals by discovering, defining, reshaping, implementing, or closing parts of the model.

A plan can carry research, context, constraints, decisions, proposed form, execution steps, verification, and closure notes. Not every plan needs every element, but the atlas should make those elements visible when they exist.

Plans may advance more than one Goal and shape more than one atlas item. Goals retain the desired outcome, while model items keep the durable system meaning after the plan becomes history.

In Ontahi terms, Plan should eventually become a first-class entity with operations such as `ReviewPlanState`, `ReshapePlan`, `ClosePlan`, `ExtractFollowUps`, and `LinkPlanToItems`.

## Recursive Modeling Pass

Plan is the first recursive modeling pass for the Atlas model because it is both the thing being defined and the medium we use to define it.

When viewing [[spec-workstream-atlas.atlas-model.plan|Plan]], the Evolution lens should stay local:

1. Work items that are actively shaping Plan.
2. Child artifacts such as [[spec-workstream-atlas.atlas-model.plan.outline-v0|Plan Outline v0]].
3. Targeted questions, decisions, tensions, or closure notes about Plan itself.

The Context lens should hold the surrounding neighborhood instead:

1. Its parent [[spec-workstream-atlas.atlas-model.work-item|Work Item]].
2. Capabilities such as [[spec-workstream-atlas.planning-projection.plan-metadata|Plan Metadata]], [[spec-workstream-atlas.assisted-editing.plan-status-review|Plan Status Review]], and [[spec-workstream-atlas.atlas-experiences.plan-closure|Plan Closure]].
3. Broader planning and assisted-editing experiences that make Plan useful but are not its local evolution.

This keeps the recursive model legible: Plan can show how it is being shaped without turning every adjacent workflow into a child.

## V0 Anatomy

The first useful model is an anatomy, not a rigid template. A plan can expose these elements when they exist:

| Element | Purpose | Common headings seen in current plans |
| --- | --- | --- |
| Summary | The shortest statement of the intended change. | Summary, Goal, Objective, Overview |
| Context | Why this matters now and what pressure created the plan. | Context, Current State, Motivation, Why This Matters, Problem |
| Research / Evidence | External references, prior plans, repo facts, examples, or constraints used while shaping. | Research, Evidence, State Of The Art Notes, Current Implementation Baseline |
| Scope | What this plan includes. | Scope, Goals, Concrete First Objectives, Target Shape |
| Out Of Scope | What is intentionally not included. | Non-Goals, Out Of Scope, Deferred Ideas |
| Proposed Form | The proposed product, model, UX, architecture, data, or workflow form. | Proposed Model, Target Shape, Conceptual Model, API Design, UX Shape |
| Execution Slices | Ordered implementation chunks, tasks, migrations, or phases. | First Slice, Implementation Plan, Migration Slices, Next Slices, Ordered Work Plan |
| Verification | How the work can be proven good enough. | Acceptance Checklist, Acceptance Criteria, Tests, Test Plan, Rollout Plan |
| Decisions | Choices made while shaping or implementing. | Decisions, Locked Decisions, Current Decisions, Decisions Log |
| Evolution / Closure | What landed, what changed, what remains, and which atlas items were reshaped. | Follow-Up Slices, Open Questions, Future Enhancements, Open Items For Future Plans |

Short plans do not need every element. Long plans should make the major elements visible enough that Atlas can render, reconcile, and close them.

## First Findings

The existing plans already contain most of this model, but not with one heading scheme:

1. `plans/done/16-extract-translate-package.md` is a compact package-refactor plan: summary, locked decisions, scope, non-goals, phases, API surface, tests, and assumptions.
2. `plans/done/11-book-ownership-permissions.md` is closer to a product/system spec: current state, industry research, proposed model, schema, source import, email, UX, phases, API, testing, rollout, metrics, and future items.
3. `plans/done/21-feedback-conversations-no-legacy.md` is a cutover plan: state, objective, decisions, non-goals, numbered steps with deliverables, tasks, and acceptance criteria.
4. `plans/done/07-translations-scripted.md` was phase-first and implementation-heavy before the reshape. The outline made the more durable distinction visible: translation capability proved, package/tooling later superseded, product workflow still open.
5. `plans/done/100-ontahi-framework-extraction.md` is a completed multi-slice plan whose final
   reconciliation separated internal source extraction from independent distribution.

The current and next plans are already converging on a smaller pattern: summary, goals/context, non-goals, target shape, slices, acceptance, and open questions.

## Child Items

1. [`Plan Outline v0`](./plan/outline-v0.md)
