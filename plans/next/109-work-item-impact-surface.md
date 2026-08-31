# 109. Work Item Impact Surface

Status: next

Parent plan: [108. Atlas Item Type Model](./108-atlas-item-type-model.md)

## Summary

Define how a Work Item describes the Atlas items and invariants it touches.

Plans are only one kind of Work Item. A bug fix, operational task, semantic drift repair, closure review, or PR can also change the system. Atlas needs a small impact language so those changes can be read as more than a checklist.

## Context

Plan 107 made `Plan` visible as a typed Work Item. Plan 108 generalized that into item types. The next pressure is impact: when work happens, what parts of the system does it change, preserve, repair, or put under tension?

The hard part is that the relationships are simultaneous:

```txt
to shape something
  may affect other items
  may preserve some invariants
  may break or restore others

to affect something
  may also be how we shape it
```

So this plan should not force one master relationship too early. It should create a vocabulary that can survive both high-level shaping plans and tiny operational tasks.

## Scope

Define a v0 impact surface for Work Items:

1. what the work intends to shape,
2. what it affects without necessarily giving durable form,
3. what invariants it preserves,
4. what invariants it breaks or risks breaking,
5. what invariants it restores,
6. what evidence proves the impact.

## Non-Goals

1. Do not model every possible relationship.
2. Do not require every task to declare impact metadata.
3. Do not make `affects` a noisy catch-all in the map UI.
4. Do not implement automated impact inference yet.

## Proposed Form

```txt
Work Item
  intent
  affected atlas items
  impact relations
    shapes
    affects
    preserves
    breaks
    restores
  evidence
  outcome
```

The distinction is intentionally soft:

1. `shapes`: the work gives durable form to an Atlas item or revises that form.
2. `affects`: the work touches, pressures, or depends on an Atlas item without claiming to define it.
3. `preserves`: the work protects an invariant while changing nearby things.
4. `breaks`: the work knowingly breaks, risks breaking, or exposes a broken invariant.
5. `restores`: the work repairs an invariant that was missing, stale, or broken.

## Example

```txt
Plan: Translation Sync v0
  shapes -> Translation Experience
  affects -> Book Import Sync
  affects -> Book
  affects -> Chapter
  preserves -> Only changed content is retranslated
  tasks
    - add translation diffing
    - persist translation job state
    - expose sync status in UI
```

```txt
Task: Recreate production translation secret
  affects -> Deployment Configuration
  affects -> Translation Worker Runtime
  preserves -> Production translation pipeline can run without exposing credentials
```

## UI Implication

When a user opens a Work Item, Atlas should eventually show a compact impact map: experiences, models, capabilities, practices, and invariants touched by that work.

This is not only for planning. It is also useful when reviewing a PR, closing a plan, or asking an assistant what is still incomplete.

## Execution Slices

1. Create the Work Item Impact Surface atlas item.
2. Add the child plan under Atlas Item Type Model.
3. Use one current plan and one small task-like example to test whether `shapes`, `affects`, `preserves`, `breaks`, and `restores` feel distinct enough.
4. Decide which relations should appear in map lines, detail panels, evolution boards, or only in source.

## Open Questions

1. Should invariants be first-class Atlas items or typed notes on existing items?
2. Should `affects` be visible in the map by default, or only inside plan detail views?
3. Does `preserves/breaks/restores` belong to relation metadata, evidence, or a separate invariant model?
4. Can Atlas infer impact from code and plan diffs, or should this stay author-declared first?

## Verification

- [x] Capture the Work Item impact vocabulary.
- [x] Link this work under Atlas Item Type Model.
- [ ] Pilot the impact surface on one current plan.
- [ ] Pilot the impact surface on one small task-like work item.
- [ ] Decide how the UI should render impact without adding map noise.

## Closure / Evolution

Not closed. The vocabulary is named, but it needs at least two grounded examples before the relation model should be treated as stable.
