# 162. Item Kind Vocabulary Audit

Status: current

## Summary

Reduce Atlas's authored kind vocabulary to categories with proven semantic meaning. Stop presenting
generic concepts and vaguely named system primitives as if they were distinct Item Types, while
preserving read compatibility for existing federated Sources.

## Context

Atlas currently projects `concept`, `system-primitive`, `territory`, `model`, `experience`, and
`capability` beside concrete kinds such as `entity`, `operation`, `interaction`, and `package`.
Several of the former categories originated as exploratory labels and never acquired distinct
anatomy, operations, evidence, or lifecycle behavior. They now make the ontology harder to explain
and make authoring choices look more precise than the model actually is.

The immediate clearest cases are `concept` and `system-primitive`. `concept` is effectively the
generic fallback for any durable named thing; `system-primitive` means that a system concern was
important without saying what form it has. Neither earns a first-class Item Type.

## Decisions

1. Add neutral `item` as the honest generic kind.
2. Treat authored `concept` and `system-primitive` as legacy aliases of `item` during ingestion.
3. Stop recommending either legacy label for new Items.
4. Preserve source Markdown and cross-repository authority; compatibility normalization happens in
   the Atlas projection rather than rewriting federated repositories from Atlas.
5. Audit `territory`, `model`, `experience`, and `capability` separately before keeping, moving to
   an orthogonal structural role, or retiring them.
6. Do not introduce `surface` as a kind until it demonstrates distinct anatomy or evidence.

## Execution Slices

### Slice 1 — Remove false semantic precision

- [x] Register `item` as the neutral generic Item kind.
- [x] Normalize legacy `concept` and `system-primitive` source values to `item`.
- [x] Rebuild persisted parsed records after the normalization contract changes.
- [x] Verify Map, search, detail, and relationships preserve the affected Items.

### Slice 2 — Audit orthogonal categories

- [ ] Classify current `territory` and `model` exemplars as semantic form or structural role.
- [ ] Define a candidate anatomy for `experience` and compare it with `interaction`.
- [ ] Define a candidate anatomy for `capability` and compare it with goals and operations.
- [ ] Keep only categories that earn distinct authoring or projection behavior.

### Slice 3 — Historical relationship backfill

- [ ] Run a one-shot first-parent `main` history analysis for commits that co-change Plans and Items.
- [ ] Produce an auditable report without creating an Atlas product workflow.
- [ ] Apply only reviewed high-signal Plan-to-Item relationships.

## Verification

1. Existing `concept` and `system-primitive` Markdown continues to ingest.
2. Their projected nodes use the neutral `item` kind.
3. Specialized Item parsers remain limited to their proven kinds.
4. No federated source file is rewritten by Atlas.
5. `pnpm verify` passes.

## Closure / Evolution

Open. The first slice removes two misleading labels. The remaining categories stay explicit audit
subjects rather than being silently declared stable or removed in bulk.

## Checkpoints

### 2026-11-23 — Neutral Item compatibility boundary

The canonical authored-kind catalog now exposes `item` instead of `concept` and
`system-primitive`. Ingestion accepts both historical labels as compatibility aliases and projects
them as neutral Items without rewriting their owning Sources. Parsed-record materialization moved
to version 3 so persisted Sources rebuild under the same normalization contract. Focused model,
snapshot, materialization, and viewer tests preserve identity, hierarchy, and navigation.
