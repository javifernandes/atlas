# 107. Plan Model Research And v0

Status: done

Parent plan: [108. Atlas Item Type Model](../next/108-atlas-item-type-model.md)

## Summary

Define `Plan` as a first-class Workstream Atlas model concept.

The goal is not to rewrite every historical plan. The goal is to understand what a plan is in Atlas, which structural elements are common enough to name, and how plans shape durable atlas items over time.

This is now the first child of the broader [Atlas Item Type Model](../next/108-atlas-item-type-model.md) work. `Plan` is useful because it makes the type-specific pattern visible: a plan has anatomy, relationships, evidence, and operations that do not apply unchanged to other item types.

## Context

BookOps and Ontahi plans have become the historical record of product, framework, and system evolution. They contain research, decisions, solution sketches, implementation checklists, follow-ups, code snippets, migrations, tests, and closure notes, but the structure is inconsistent.

Atlas already visualizes plans and semantic items. The next step is to stop treating plans as only markdown files and define the model they imply.

The key relationship is:

```txt
Plan
  shapes
    durable atlas items
  and may be implemented by
    code, docs, tests, migrations, stories, workflows, and PRs
```

## Scope

This plan defines Plan Outline v0 and uses a small set of existing BookOps/Ontahi plans to test it.

The work should:

1. identify common plan anatomy without forcing every plan into the same size,
2. preserve useful local plan idioms,
3. make closure, follow-up, and semantic impact easier to read,
4. define enough structure for Atlas UI rendering and future LLM reconciliation,
5. leave broader item-type modeling to plan 108.

## Research Inputs

Use external planning/spec traditions as evidence, not as a template to copy blindly:

1. [Shape Up](https://basecamp.com/shapeup): pitches separate problem, appetite, solution shape, rabbit holes, and no-gos.
2. [Scrum Guide](https://scrumguides.org/scrum-guide.html) and agile planning: keep product goal, backlog item, work execution, and done evidence distinct.
3. Spec-driven development, including [Kiro specs](https://kiro.dev/docs/specs/) and [GitHub Spec Kit](https://github.com/github/spec-kit): split requirements, design/plan, and tasks.
4. [MADR](https://adr.github.io/madr/): capture decision context, options, outcomes, and consequences.
5. [Gherkin](https://cucumber.io/docs/gherkin/reference/): make expected behavior testable through scenarios.
6. Existing BookOps and Ontahi plans: preserve the useful local idioms that emerged from real work.

## Proposed Form

A plan may contain these elements:

1. Summary: what this plan is trying to change.
2. Context / Problem: why the change matters now.
3. Research / Evidence: external references, prior plans, repo facts, product examples, or implementation constraints.
4. Scope: what is included.
5. Out Of Scope: what is intentionally excluded.
6. Requirements / Scenarios: product, system, or behavior expectations.
7. Proposed Form: proposed model, UX, architecture, data, or workflow form.
8. Decisions: choices made while shaping the plan.
9. Execution Plan: ordered slices, tasks, migrations, or implementation steps.
10. Verification: tests, stories, manual checks, rollout checks, and acceptance criteria.
11. Risks / Open Questions: unresolved pressure.
12. Closure / Evolution: what landed, what changed, what remains, and which atlas items were reshaped.

These are named elements, not mandatory headings. Short tactical plans should stay short.

## Initial Reading Set

Use a small archaeological reading set before reshaping anything broadly:

1. `plans/done/16-extract-translate-package.md`
2. `plans/done/11-book-ownership-permissions.md`
3. `plans/done/21-feedback-conversations-no-legacy.md`
4. `plans/done/07-translations-scripted.md`
5. `plans/done/100-ontahi-framework-extraction.md`

The first pass should identify which elements are shared, which are optional, and which are incompatible enough to stay free-form.

## Reading Notes

The initial reading set shows a family resemblance rather than one strict shape:

1. `plans/done/16-extract-translate-package.md` is compact and migration-oriented: summary, locked decisions, scope, non-goals, implementation phases, public API surface, test plan, and assumptions.
2. `plans/done/11-book-ownership-permissions.md` is a full product/system spec: current state, industry research, proposed model, schema, source declaration, email integration, UI/UX, implementation phases, APIs, component structure, decisions, security, tests, rollout, metrics, and future items.
3. `plans/done/21-feedback-conversations-no-legacy.md` is a cutover plan: state, objective, locked decisions, non-goals, step-by-step work with deliverables/tasks/acceptance, risks, and MVP configuration.
4. `plans/done/07-translations-scripted.md` is phase-first and implementation-heavy in its original form: provider abstraction, data model, prompt design, scripts, API layer, UI, future enhancements, and files overview.
5. `plans/done/100-ontahi-framework-extraction.md` is a completed multi-slice plan: summary,
   why/end-state, package direction, checkpoints, readiness table, closure, and an extracted
   independent-distribution follow-up.

Current and next plans already converge around a smaller set of headings: summary, goals/context, non-goals, target shape, execution slices, acceptance, and open questions.

## Reshape Notes

The first reversible reshape used `plans/done/16-extract-translate-package.md` because it is compact, complete, and historically important for the translation capability.

Findings:

1. The outline fits the plan without forcing fake sections. `Summary`, `Context`, `Scope`, `Non-Goals`, `Proposed Form`, `Execution Slices`, `Verification`, `Decisions`, `Open Questions`, and `Closure / Evolution` all carried real information.
2. `Research / Evidence` was useful even without external research. It became local implementation evidence: package files, shared model types, root scripts, and historical plan links.
3. `Closure / Evolution` exposed the most important semantic distinction: the package extraction is done, but BookOps translation remains an unfinished product/system capability under `bookops.internationalization-translations`.
4. The reshape surfaced a housekeeping problem: there are two historical plan-16 files. The canonical source is now `16-extract-translate-package.md`; the duplicate/superseded-plan policy should be handled as follow-up instead of hidden inside the outline.

The second reshape used `plans/done/07-translations-scripted.md` because it is the opposite shape: a long phase-first capability plan that flattened into many headings in the Atlas section index.

Findings:

1. The outline worked as a compression lens. It preserved the important phases, but nested them under `Execution Slices` so Atlas can show the plan anatomy before implementation detail.
2. `Closure / Evolution` again carried the strongest product signal: the script-first translation plan is done, the package/tooling path evolved into plan 16, and the broader translation product capability remains open.
3. The reshape pass suggests that historical plan cleanup should not only rename headings. It should identify what became history, what became an atlas capability, and what follow-up work should attach to that capability.

Comparison with `plans/done/100-ontahi-framework-extraction.md` shows why long-running plans need
richer `Closure / Evolution`: accumulated checkpoints should converge into a finite landed intent,
while materially different remaining work becomes a linked follow-up.

## Atlas Updates

Create or refine these atlas items:

1. `spec-workstream-atlas.atlas-model.plan`
2. `spec-workstream-atlas.planning-projection.plan-metadata`
3. `spec-workstream-atlas.atlas-model.plan.outline-v0`

Do not create an operating practice yet. A practice should come after the plan model proves useful enough to become a repeated workflow or skill.

## Recursive Modeling Pass

Use `Plan` itself as the first recursive modeling pass for Atlas. This lets Atlas test the difference between:

1. local evolution: child artifacts, shaping plans, and targeted semantic signals that directly change the Plan model;
2. surrounding context: planning projection, plan metadata, plan status review, plan closure, assisted editing, and other capabilities that make Plan operationally useful.

That split matters because otherwise every useful workflow around a Plan looks like a child of Plan, and the model becomes unreadable.

## Canonical Outline v0

The v0 outline is a lens, not a mandatory template:

1. Summary
2. Context
3. Research / Evidence
4. Scope
5. Non-Goals
6. Proposed Form
7. Execution Slices
8. Verification
9. Decisions
10. Open Questions
11. Closure / Evolution

Short tactical plans can omit sections. Large plans should make the major elements visible enough that Atlas can render, reconcile, and close them.

## Execution Slices

1. Read a small archaeological set of plans with different shapes.
2. Extract common plan elements and note which ones are optional.
3. Reshape one compact historical plan to test the outline.
4. Reshape one phase-heavy historical plan to test compression.
5. Use `Plan` itself as a recursive Atlas model example.
6. Capture follow-up work for plan reconciliation, assisted editing, closure, and backfill.

## Decisions

1. The durable concept is `Plan`, not `Plan Shape`.
2. `Plan` is a kind of work item.
3. A plan shapes atlas items; the durable atlas item is later read as shaped by that plan.
4. Planning Projection is an experience/capability over Plan and other atlas entities, not the parent of Plan.
5. Research can be a first-class section of a plan when the plan needs discovery or external evidence.

## Open Questions

1. Which plan elements deserve structured frontmatter and which should remain markdown sections?
2. Should plans eventually become Ontahi entities backed by operations, or remain markdown-first with an Ontahi adapter?
3. How much historical plan backfill is worth doing?
4. How should Atlas represent a plan that was superseded, abandoned, or split into follow-ups?
5. How should `ReviewPlanState` write its findings: inline plan update, separate closure note, atlas proposal, or PR?

## Follow-Up Work

1. [110. Plan Backfill And Reconciliation](./110-plan-backfill-and-reconciliation.md): turn the outline into a real cleanup and interpretation workflow for existing plans.
2. [106. Atlas Plan Reconciliation Operation](../next/106-atlas-plan-reconciliation-operation.md): define the repo-aware `ReviewPlanState` operation.
3. [103. Workstream Atlas Assisted Editing](../backlog/103-workstream-atlas-assisted-editing.md): expose proposal-based LLM editing in the Atlas UI.
4. [[spec-workstream-atlas.atlas-experiences.plan-closure|Plan Closure]]: define the post-plan workflow that records what landed, drifted, or became future work.

## Verification

- [x] Create the `Plan` atlas model item.
- [x] Rename the planning projection item from `Plan Shape Metadata` to `Plan Metadata`.
- [x] Read the initial plan set and extract common plan elements.
- [x] Propose a v0 canonical plan outline.
- [x] Use `Plan` itself as the first Evolution/Context modeling pass.
- [x] Reshape one compact plan as a reversible example.
- [x] Reshape a second phase-heavy historical plan as a compression example.
- [x] Keep Outline v0 as an authoring and rendering lens rather than a mandatory template or lint rule.
- [x] Capture follow-up work for plan closure, status review, assisted editing, and backfill.

## Closure / Evolution

Closed on 2026-09-01. The research established `Plan` as a first-class Atlas concept and Outline v0
as a flexible authoring and rendering lens, not a mandatory template or lint rule. Backfill proved
the lens on historical plans and remains a just-in-time closure practice. The operational
follow-ups stay independently owned by plans 106 and 103 and the Plan Closure item.
