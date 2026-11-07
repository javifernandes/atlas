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

### Consumer and framework plan ownership

Keep the complete product intervention in the repository that owns the product behavior, even when
the implementation depends on a generic framework such as Ontahí. For Atlas work, Atlas owns the
plan sections that describe its user experience, domain rules, entities, migrations, rollout,
acceptance criteria, and application-specific verification.

The framework repository owns only the reusable framework capability discovered or required by
that consumer work. An Ontahí plan may cite an Atlas plan as consumer evidence, motivation, or an
adoption proof, but it must express the provider-neutral contract without importing Atlas domain
vocabulary or making Ontahí authoritative for Atlas product behavior.

Connect the two plans with canonical source URIs rather than copying one plan into the other:

```text
Atlas product plan
  -> depends on ontahi://plans/<generic-framework-capability>

Ontahí framework plan
  -> cites atlas://plans/<consumer-intervention> as evidence
```

Use the same rule for any external framework or platform:

1. identify which repository owns the observable product outcome;
2. keep the bulk of that intervention and its closure contract there;
3. extract only the smallest reusable capability into the provider repository;
4. let each repository verify and evolve its own responsibility;
5. do not move a consumer adoption plan into a framework repository merely because the framework
   supplies its execution primitives.

## Pull Request Audit

Before opening or updating a PR, answer:

1. Which current plan does this implement or reshape?
2. Does its checklist or checkpoint reflect what actually landed?
3. Did the work change a durable Atlas item?
4. Should any completed work move to `done/` or produce a focused follow-up?
5. Are cross-repository references canonical rather than copied or accidentally source-local?
6. If the work crosses a consumer/framework boundary, does each repository own only its product or
   provider-neutral portion?
