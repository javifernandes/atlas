# 110. Plan Backfill And Reconciliation

Status: next

Parent plan: [107. Plan Model Research And v0](./107-plan-model-research-and-v0.md)

## Summary

Use Plan Outline v0 to clean up plans that matter for current work.

This is not a planning bureaucracy and not a mass rewrite. A plan gets reshaped only when it helps us answer: what was intended, what landed, what changed, what remains, and which Atlas items were shaped.

## Context

Plans 16 and 07 proved that old plans can become much easier to read when their history is compressed into a clearer outline.

They also exposed the danger: we could spend too much time cataloging the catalog. The backfill should stay close to real work.

## Scope

1. Pick high-value plans as they become relevant.
2. Reshape them into Plan Outline v0 when that improves understanding.
3. Add `Closure / Evolution` notes that separate landed work from open capability work.
4. Link plans to durable Atlas items when the relationship is clear.
5. Mark duplicates, superseded paths, or extracted follow-ups only when they create actual confusion.

## Proposed Form

Treat backfill as a small batch operation, not a permanent ceremony:

```txt
choose relevant plan cluster
  -> read original intent and current atlas links
  -> reshape headings only where meaning improves
  -> preserve historical details
  -> add closure / evolution summary
  -> commit a coherent batch
```

The result should make a plan easier to reconcile later. It should not erase the fact that old plans were written under looser conventions.

## Guardrails

1. Do not create a work item for every plan.
2. Do not maintain a huge inventory unless the UI or agent needs it.
3. Do not touch `plans/current/100*` while that family is active in another worktree.
4. Do not rewrite historical plans just to make headings match.
5. Prefer one useful reshaped plan over ten meta-plans about reshaping.

## Execution Slices

1. [x] Pick one current or next plan outside the `100*` family: [106. Atlas Plan Reconciliation Operation](./106-atlas-plan-reconciliation-operation.md).
2. [x] Pick one recent done plan that still explains current product or framework behavior: [21. Feedback Conversations And Notifications Cutover](bookops://plans/21-feedback-conversations-no-legacy).
3. [x] Reshape both with Plan Outline v0.
4. [x] Record only the follow-ups that are real work: implementation, Atlas item updates, status reconciliation, or duplicate cleanup.
5. [x] Continue with focused batches when the user is actively using a plan cluster.

## Verification

This work is useful if a human or LLM can quickly read a reshaped plan and answer:

1. what happened,
2. what remains,
3. what changed from the original idea,
4. which model, experience, capability, or practice the plan shaped.

## Closure / Evolution

First pass complete with plans 106 and 21.

Do not expand this into a broad inventory yet. Continue using the backfill only when a plan becomes relevant to current work or when repeated interpretation cost becomes obvious.
