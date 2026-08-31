# 115. Atlas Definition Level Axis

Status: backlog

Definition level: seed

Parent plan: [108. Atlas Item Type Model](../next/108-atlas-item-type-model.md)

## Summary

Model how defined an Atlas item or work item is.

The current status axis says something about time or delivery: done, current, next, backlog, idea. It does not say whether an item is only a named intuition, a framed problem, an outlined plan, or a well-shaped piece of work with scope, slices, and verification.

## Context

The Atlas/Ontahi application chain makes the gap visible:

1. [111. Atlas As An Ontahi Application](../current/111-atlas-as-ontahi-application.md) is relatively shaped.
2. [112. Ontahi Capability Package Composition v0](bookops://plans/112-ontahi-capability-package-composition-v0) is outlined.
3. [113. BookOps Conversations Capability Extraction](bookops://plans/113-bookops-conversations-capability-extraction) is framed.
4. [114. Atlas Conversations](./114-atlas-conversations.md) is only a seed.

All four may be valuable. They should not pretend to have the same definition.

## Scope

Explore a fuzzy definition axis for Atlas.

Possible values:

1. `seed`: named intuition or placeholder.
2. `framed`: problem/context is clear enough to discuss.
3. `outlined`: scope and likely slices exist.
4. `shaped`: target form, tradeoffs, slices, and verification are clear enough to execute.
5. `grounded`: reconciled with implementation evidence.

## Non-Goals

1. Do not turn this into rigid estimation.
2. Do not replace status, priority, or horizon.
3. Do not require every historical item to be labeled.
4. Do not make `grounded` imply product validation or user satisfaction yet.

## Proposed Form

Definition level should be an Atlas axis, not a delivery status.

```txt
status
  where it sits in time or delivery

definition level
  how formed the idea is

evidence
  what proves the current claim
```

This could eventually affect UI:

1. badges in board cards,
2. filters for under-defined current work,
3. warnings before execution,
4. assisted prompts to move a seed toward a shaped plan,
5. reconciliation prompts to move implemented work toward grounded.

## Execution Slices

1. Try the axis on a small set of new and current plans.
2. Decide whether the source field is `definitionLevel`, `maturity`, `shape`, or something else.
3. Update Atlas rendering only after the vocabulary feels useful.
4. Teach assisted editing to ask different questions by definition level.

## Verification

- [ ] The axis helps distinguish vague ideas from executable plans.
- [ ] It does not duplicate status or horizon.
- [ ] It helps humans decide what kind of shaping work is needed next.
- [ ] It gives LLM agents better prompts without creating bureaucracy.

## Open Questions

1. Is `grounded` the right name for implementation-backed work?
2. Should this apply to all Atlas items or only work items?
3. Should definition level be manually declared, inferred, or both?
4. How should Atlas show uncertainty without making the UI noisy?

## Closure / Evolution

Not started. This is a seed so the idea does not disappear while the main Ontahi application path proceeds.
