# 104. Atlas Source Shape v0

Status: done

## Summary

Define the first explicit source shape for the Workstream Atlas: markdown item metadata, supported item kinds, relationship fields, evidence bindings, and operating practices.

This is a product-control slice, not a full methodology. The goal is to make the atlas useful for answering practical questions about what exists, what changed, what is stale, and what evidence supports the current product model.

## Context

Plan 101 introduced a markdown-first semantic source beside `plans/`. After using the atlas UI, the source needs a clearer contract: which item kinds exist, how references work, which relations are meaningful, and how the same model can describe both Atlas itself and messier BookOps/Ontahi history.

The pressure is practical. If the source stays too loose, every UI view and LLM workflow must reinterpret scattered prose. If it becomes too rigid too soon, it will block discovery.

## Scope

Create a small contract that supports:

1. semantic model items beyond plans,
2. links from model items to plans and work history,
3. links from model items to implementation evidence,
4. operating practices such as dual grounding and archaeological reading,
5. future LLM-assisted editing without requiring a rigid system upfront.

## Proposed Form

Define `atlas/SOURCE-SHAPE.md` as the v0 contract for markdown atlas items.

The source should support:

1. item metadata in frontmatter,
2. a controlled but evolving set of item kinds,
3. explicit structural relationships such as parent/containment,
4. semantic relationships such as supports, shaped-by, typeOf, and exemplars,
5. inline atlas references for readable prose,
6. source rendering that can distinguish overview, context, evolution, and raw source.

The source contract stays markdown-first. JSON, YAML-only, or Ontahi-backed forms can come later if the contract proves useful.

## Execution Slices

1. [x] Add `atlas/SOURCE-SHAPE.md` as the v0 markdown contract.
2. [x] Extend atlas item kinds to include concepts, entities, operations, artifacts, evidence, and practices.
3. [x] Remodel the Workstream Atlas branch enough to show:
   - Atlas Model
   - Atlas Experiences
   - Operating Practice
4. [x] Add a first pass at atlas references and exemplars so model concepts can point to concrete examples across Atlas, BookOps, and Ontahi.
5. [x] Keep BookOps backfill out of this first slice, except as examples in the source-shape document.

## Non-Goals

1. Do not migrate all historical plans.
2. Do not make the Atlas model fully self-hosting.
3. Do not replace `plans/` or GitHub Project sync.
4. Do not build assisted editing UI yet.
5. Do not require every item to have evidence bindings.

## Dual Grounding

Every new atlas concept should be checked against two cases:

1. the Workstream Atlas itself, as a clean reflective case,
2. a concrete BookOps cluster, as a messy historical case.

The first BookOps cluster should probably be Sharing and Collaboration because it already contains roles, entities, operations, experiences, plans, and implementation evidence.

## Verification

1. [x] `atlas/SOURCE-SHAPE.md` explains v0 fields, kinds, relationships, and extraction boundaries.
2. [x] The Atlas parser accepts the new item kinds without collapsing them to `capability`.
3. [x] Workstream Atlas has explicit nodes for model, experiences, and operating practice.
4. [x] The source shape explains declarations, references, and exemplars without requiring the UI to render them yet.
5. [x] The change remains compatible with the standalone Atlas parser and viewer.

## Closure / Evolution

Closed after the v0 contract, richer item kinds, Atlas self-model, references, and standalone parser
compatibility all landed. The source contract and its durable item tree moved into the standalone
Atlas repository on 2026-08-31. Assisted editing, reconciliation, and the typed item model remain in
their focused follow-up plans.

- Status: done
- Closed on: 2026-08-31
- Effective effort: historical; unknown
