# 101. Workstream Atlas Semantic Source

Status: done

## Summary

BookOps has accumulated many plans that describe product work, architecture work, workflow work, and extracted framework work at the same level. The current plan graph makes that history visible, but it also shows that plans are not the right root abstraction for understanding the system.

This plan introduces a small `atlas/` directory where product and framework concerns can be represented as semantic items: projects, territories, experiences, capabilities, and system primitives. Plans become transverse records of work that shape one or more atlas items.

The goal is to create a shared product language that can be read by humans, navigated by the internal atlas UI, and manipulated by LLM agents through ordinary markdown changes.

## Context

The earlier `plans/` tree worked as a lightweight kanban while the main interaction was manual filesystem browsing. Once the internal atlas UI started rendering the plan graph, it exposed a deeper problem: the meaningful structure is not only plan state. The system also has durable concepts, experiences, capabilities, and project boundaries that plans discover and change over time.

This plan keeps the existing operational plan workflow intact while adding a semantic source beside it.

## Scope

Create an initial semantic source that can answer:

1. what are the durable parts of BookOps, Ontahi, and the Workstream Atlas,
2. which plans shaped each part,
3. which areas are active, still shaping, or only ideas,
4. how the conceptual map differs from the operational kanban.

Do not migrate all existing plans into the atlas. Plans stay in `plans/` so the current GitHub Project sync and folder-based workflow keep working.

## Proposed Form

Add an `atlas/` directory with markdown item files. Each item should be small enough for humans and LLMs to edit, but structured enough for the UI parser to extract:

1. stable id,
2. title,
3. kind,
4. status or horizon,
5. parent / containment,
6. relationships to other atlas items,
7. related plans,
8. a short description.

Plans remain work records. Atlas items become the durable product/system language those plans shape.

## Execution Slices

1. [x] Add the first metadata contract.
2. [x] Add seed atlas items for BookOps, Ontahi, and the Workstream Atlas itself.
3. [x] Link atlas items to representative existing plans without migrating the old plan tree.
4. [x] Keep operational plans in `plans/`.

## Non-Goals

1. Do not move all existing plans into the atlas.
2. Do not replace the GitHub Project sync yet.
3. Do not turn the filesystem into a final architecture decision.
4. Do not design a full lifecycle model beyond the minimal fields needed now.

## Verification

The slice is useful when the internal atlas UI can read both sources:

1. [x] `plans/` still provides operational work items and status.
2. [x] `atlas/` provides semantic items and relationships.
3. [x] Existing project sync does not break.
4. [x] A user can open the atlas and see BookOps, Ontahi, and Workstream Atlas as separate project-level items.

## Related Atlas Items

1. [`spec-workstream-atlas`](../../atlas/items/spec-workstream-atlas.md)
2. [`bookops`](bookops://atlas/bookops)
3. [`ontahi`](ontahi://atlas/ontahi)

## Related Plans

1. [`99-semantic-editorial-workflows.md`](bookops://plans/99-semantic-editorial-workflows)
2. [`100-ontahi-framework-extraction.md`](bookops://plans/100-ontahi-framework-extraction)
3. [`68-unified-application-architecture-surface.md`](bookops://plans/68-unified-application-architecture-surface)

## Closure / Evolution

Closed after the semantic item tree, plan relationships, federated viewer, and standalone Atlas
application proved the source useful. The canonical Atlas-owned source moved from BookOps into the
standalone Atlas repository on 2026-08-31. Richer source semantics continue through Plans 104–111.

- Status: done
- Closed on: 2026-08-31
- Effective effort: historical; unknown
