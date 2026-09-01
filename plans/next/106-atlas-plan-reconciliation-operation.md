# 106. Atlas Plan Reconciliation Operation

Status: next

## Summary

Add the first Ontahi-shaped assisted operation to the Workstream Atlas: from a selected plan, ask Atlas to reconcile the historical plan against the living system.

The operation should answer:

1. what appears to have landed,
2. what changed during implementation,
3. what remains open,
4. what was superseded or abandoned,
5. what follow-up plans or atlas item updates should be proposed next.

This is the smallest useful bridge between plans as historical work records, atlas items as durable product/system memory, and Ontahi operations as the typed action language that can make those questions executable.

## Context

Large plans become hard to trust after real implementation work. Checklists drift, decisions change, branches continue in local code, and the interesting question stops being "what did the markdown originally say?" and becomes "what is true now?"

Today that reconciliation happens in chat with a repo-aware agent. Atlas should make it a first-class workflow:

1. a button in the plan or item UI,
2. a conversational command such as "review this plan state",
3. a structured proposal that a human can inspect before any file changes happen.

Atlas can run against projects that do not use Ontahi, but Atlas plus Ontahi should be the optimized path: entities, operations, refs, relations, evidence, and source bindings are already closer to the implementation, so the agent spends less effort reinterpreting the system from scratch.

## Research / Evidence

1. Current work on [Plan](../done/107-plan-model-research-and-v0.md) and [Plan Backfill And Reconciliation](../done/110-plan-backfill-and-reconciliation.md) keeps returning to the same operational question: which parts of a plan are still true?
2. `plans/done/100-ontahi-framework-extraction.md` is the motivating historical case: manual
   reconciliation closed its landed extraction work and split independent distribution into plan
   129. That before/after state is useful regression evidence for an automated review.
3. Atlas already has plan markdown, atlas item links, graph structure, and local repo access in development. The missing piece is a named operation that assembles and judges that context.
4. [Workstream Atlas Assisted Editing](../backlog/103-workstream-atlas-assisted-editing.md) provides the broader proposal-based UX; this plan defines the smallest concrete operation inside that experience.

## Scope

1. Define the minimal `ReviewPlanState` operation contract.
2. Assemble context for one selected plan from markdown, atlas links, and repo evidence.
3. Produce a structured read-only proposal.
4. Render the proposal in Atlas or write it to a reviewable local artifact.
5. Keep mutation, PR creation, and production automation outside the first slice.

## Non-Goals

1. No automatic plan closure.
2. No automatic atlas rewrite.
3. No production GitHub App trigger yet.
4. No multi-user proposal review system yet.
5. No attempt to reconcile every historical plan in one pass.

## Proposed Form

The first operation can be named `ReviewPlanState`.

Inputs:

1. `planPath`
2. optional selected atlas item id
3. optional branch/base commit range
4. optional user question or focus

Context sources:

1. the selected plan markdown,
2. related atlas items,
3. linked plans and follow-ups,
4. git status and changed files,
5. nearby implementation files, tests, stories, docs, and generated artifacts,
6. explicit user-provided context from the current session.

Output:

1. landed work, with evidence,
2. implementation drift, with evidence or inference labels,
3. open work,
4. superseded or abandoned parts,
5. proposed follow-up plans,
6. proposed atlas item updates,
7. questions that need human judgment,
8. optional markdown patches for review.

The output is a proposal, not an automatic mutation.

### UX Shape

In the full plan modal, expose a `Review state` action.

In chat, allow a user to ask the same thing in prose:

```txt
What is still open in this Ontahi plan?
```

Atlas should translate the prose into the same operation when the intent is clear, then show a reviewable result. Later, the same operation can be used by PR hooks, GitHub push listeners, or branch preview workflows.

### Concrete Example

Before plan 100 was manually reconciled, `ReviewPlanState` should have produced a proposal like:

1. "Package rename landed" with file and test evidence.
2. "Action/result protocol changed during implementation" with changed package paths and related tests.
3. "The internal source-extraction closure gates are met" with links to package and Todo evidence.
4. "Independent package distribution is a different problem" with a proposed follow-up.
5. "Suggested atlas update: separate source organization from independent distribution."

The exact claims must be grounded in the repo at the time of review.

## Execution Slices

1. [ ] Define the minimal `ReviewPlanState` operation contract.
2. [ ] Assemble context for one selected plan from markdown, atlas links, and repo evidence.
3. [ ] Produce a structured read-only proposal with landed, drifted, open, superseded, follow-up, and atlas-update sections.
4. [ ] Exercise the operation against the pre-reconciliation history and current closed form of
       `plans/done/100-ontahi-framework-extraction.md`.
5. [ ] Render the proposal in Atlas or write it to a reviewable local artifact.
6. [ ] Keep file mutation and PR creation out of the first slice unless explicitly authorized.

## Verification

1. The proposal cites concrete evidence instead of relying on confidence scores.
2. The user can inspect the proposal before any file changes happen.
3. The operation can answer a narrow question without reconciling the whole repo.
4. The output is structured enough to later become an Atlas UI card, markdown patch, or PR proposal.

## Decisions

1. Prefer cited evidence over confidence scores.
2. Preserve the human review step.
3. Keep the first operation local or manually triggered.
4. Treat Ontahi as the preferred operation substrate, but do not require every target project to be Ontahi-based.
5. Reuse existing plan and atlas markdown as the source of truth until a stronger storage model earns its keep.

## Open Questions

1. Should the operation run as a local-only dev tool first, or as a server-side Atlas action with a configured provider?
2. Where should the proposal be stored if the user does not immediately apply it?
3. How much code evidence is enough before the operation should ask the user for judgment?

## Closure / Evolution

Not closed. This plan is a next step for making Plan Backfill And Reconciliation executable instead of purely manual.
