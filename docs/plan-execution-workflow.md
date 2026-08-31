# Plan Execution Workflow

Atlas plans are repository-owned intervention records. Atlas items are the durable product and
system forms those plans shape.

## Folder Semantics

- `plans/current/`: work actually in progress
- `plans/next/`: actionable work ready to be pulled
- `plans/backlog/`: deferred or not-yet-shaped work
- `plans/research/`: option studies and research spikes
- `plans/done/`: historical work whose main intent landed

The folder is the operational status. Keep `Status:` aligned with it.

## Authoring And Execution

1. Use [`Plan Outline v0`](../atlas/items/spec-workstream-atlas/atlas-model/plan/outline-v0.md) for
   substantial new or reshaped plans.
2. Move a plan to `current/` before implementation starts.
3. Treat its checklist and verification section as the closure contract.
4. Record implementation discoveries and deferred scope instead of silently dropping them.
5. Update the smallest relevant file under `atlas/items/spec-workstream-atlas/` when the work
   changes a durable Atlas shape.
6. Move completed plans to `done/` with a short closure record and explicit follow-ups.

## Ownership And References

Use repository-relative paths for Atlas-owned plans and items. Use canonical source URIs for
external ownership:

```txt
bookops://plans/133-atlas-standalone-extraction
bookops://atlas/bookops
ontahi://atlas/model/entity
```

Historical plans remain in the repository where the intervention occurred unless they are still
the canonical evolving description of an independently owned system. Do not create duplicate
copies merely to make a local link convenient.

## Pull Request Audit

Before opening or updating a PR, answer:

1. Which current plan does this implement or reshape?
2. Does its checklist or checkpoint reflect what actually landed?
3. Did the work change a durable Atlas item?
4. Should any completed work move to `done/` or produce a focused follow-up?
5. Are cross-repository references canonical rather than copied or accidentally source-local?
