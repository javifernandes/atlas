---
id: spec-workstream-atlas.atlas-model.plan.outline-v0
kind: artifact
title: Plan Outline v0
parent: spec-workstream-atlas.atlas-model.plan
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.atlas-model.plan
  - spec-workstream-atlas.planning-projection
  - spec-workstream-atlas.assisted-editing.plan-status-review
  - spec-workstream-atlas.atlas-experiences.plan-closure
relatedPlans:
  - plans/next/107-plan-model-research-and-v0.md
  - plans/next/110-plan-backfill-and-reconciliation.md
exemplars:
  - plans/next/107-plan-model-research-and-v0.md
  - plans/done/104-atlas-source-shape-v0.md
  - plans/done/100-ontahi-framework-extraction.md
  - plans/done/07-translations-scripted.md
  - plans/done/16-extract-translate-package.md
---

## Summary

Plan Outline v0 is the first reusable outline for writing and reshaping [[spec-workstream-atlas.atlas-model.plan|Plan]] documents.

It is a rendering and authoring lens before it is a rule. A short tactical plan can omit most sections. A large plan should expose enough structure that Atlas can answer: what changed, why, what is included, what is excluded, how it will be executed, how it will be verified, and what evolution remains.

## Context

The first plan model pass found that current and historical plans already share common plan elements, but they use inconsistent headings. The outline should make those elements visible without forcing a mechanical rewrite of every old markdown file.

This item is part of the first recursive Atlas modeling pass: using [[spec-workstream-atlas.atlas-model.plan|Plan]] itself as the example for separating local evolution from surrounding context. It should appear as local evolution of Plan, while tools such as plan status review and plan closure remain contextual capabilities.

## Research / Evidence

Existing headings should map into the outline instead of being renamed mechanically:

1. `Goal`, `Objective`, and `Overview` usually map to `Summary`.
2. `Current State`, `Problem`, `Why This Matters`, and `Motivation` map to `Context`.
3. `Research`, `Evidence`, `State Of The Art Notes`, and implementation inventories map to `Research / Evidence`.
4. `Proposed Model`, `Conceptual Model`, `Target Shape`, `API Design`, and `UX Shape` map to `Proposed Form`.
5. `First Slice`, `Implementation Plan`, `Migration Slices`, `Next Slices`, and `Ordered Work Plan` map to `Execution Slices`.
6. `Acceptance Checklist`, `Acceptance Criteria`, `Tests`, `Test Plan`, and `Rollout Plan` map to `Verification`.
7. `Follow-Up Slices`, `Future Enhancements`, and `Open Items For Future Plans` map to `Closure / Evolution` or a future plan link, depending on whether they describe history or pending work.

## Scope

This outline is meant for new plans, active plans, and selective reshaping of high-value historical plans.

## Non-Goals

This is not a mandatory lint rule yet, and it should not trigger broad historical plan rewrites by itself.

## Proposed Form

```md
# <number>. <plan title>

Status: <current | next | backlog | research | done | unmaterialized>

## Summary

One or two paragraphs describing the intended change.

## Context

Why this matters now. Include current state, problem pressure, constraints, and relevant system history.

## Research / Evidence

External references, prior plans, code facts, product examples, implementation constraints, or decisions already discovered.

## Scope

What this plan includes.

## Non-Goals

What this plan intentionally does not include.

## Proposed Form

The proposed product, model, UX, architecture, data, workflow, or source shape.

## Execution Slices

Ordered implementation slices. Each slice may contain tasks, migrations, files, risks, or acceptance notes.

## Verification

Tests, storybook stories, manual checks, rollout checks, acceptance criteria, and evidence needed to call the work complete.

## Decisions

Choices made while shaping this plan.

## Open Questions

Unresolved pressure.

## Closure / Evolution

What landed, what changed while implementing, what was abandoned, which follow-ups were extracted, and which atlas items were reshaped.
```

## Execution Slices

1. Use the outline as an Atlas rendering lens.
2. Reshape one compact plan as a reversible example.
3. Compare that reshaped plan against active plans before turning the outline into a template.
4. Decide later whether this becomes a template, a lintable convention, or only a semantic rendering lens.

## Verification

The outline is useful if Atlas can use it to render cleaner sections, support plan review, extract follow-ups, and explain how a plan reshaped durable atlas items.

## Decisions

Do not rewrite historical plans only to match this outline. Use the outline first as an Atlas parsing/rendering lens. Rewrite a plan only when the rewrite improves future work, clarifies status, or prevents repeated reconciliation cost.

## Open Questions

1. Which fields belong in frontmatter instead of markdown sections?
2. Should `Closure / Evolution` be written inside the plan, as a sibling closure note, or as an Atlas proposal?
3. How strict should new plans be compared with historical plans?

## Closure / Evolution

Not closed yet. The next step is to use the outline in the plan backfill and reconciliation work, then decide where it feels natural or too rigid.
