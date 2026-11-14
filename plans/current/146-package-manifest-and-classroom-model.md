# 146. Package Manifest And Classroom Model

Status: current

Definition level: prototype

## Summary

Introduce a repository-local Package manifest and use a model-first Classroom package to test
`Package` and `Entity` as Atlas Item Types without first modeling Atlas itself.

## Context

Repository is too coarse to express the implementation and semantic boundaries inside a monorepo.
Ontahí contains libraries and example applications, but Atlas currently flattens their items into
the repository Source. The Item Type work also needs a non-recursive system where Entity anatomy,
Operations, invariants, state, and later Experiences can become concrete.

## Proposed Form

```text
<package-root>/atlas.package.md
<package-root>/atlas/items/**/*.md
```

The manifest is an ordinary Atlas Item with `kind: package`. Package-local items retain stable ids
and use `parent` to declare semantic containment. Discovery scans each Source repository while
ignoring dependency and build directories. A Package does not arise merely because a folder has a
`package.json`.

The first example is Ontahí's existing `examples/classroom` package, containing an
`EnrollmentInvitation` Entity. Ontahí remains authoritative for that Package and its model; Atlas
owns only the generic discovery and presentation convention. Typed Operations and derived
state/availability views remain a later slice after the Package boundary is visible end to end.

## Execution Slices

1. [x] Define the `atlas.package.md` convention and `package` item kind.
2. [x] Discover manifests and package-local `atlas/items` in local and GitHub Sources.
3. [x] Project Package containment through the existing semantic graph.
4. [x] Add a Classroom package manifest and one Entity item beside the implementation in Ontahí.
5. [x] Present Package identity, kind, repository path, code, and manifest links in full detail.
6. [x] Keep structural Package children out of temporal Evolution stages; aggregate Plans across
   the Package's full containment subgraph.
7. [x] Define the Entity Model v0 vocabulary for data, relations, states, operations, applicability,
   authority, effects, and invariants.
8. [x] Model the first coherent Classroom App subgraph: User, Classroom, Enrollment, and Enrollment
   Invitation.
9. [x] Add a local Workspace reconciliation command that invokes the same durable Operation as the
   UI instead of updating only the global projection.
10. [x] Define Operation Model v0 and reify Enrollment Invitation's `Accept` behavior as the first
    linked Operation Item.
11. [x] Parse Entity Model tables into the semantic snapshot and derive a statechart inside the
    Entity's States section.
12. [x] Materialize authored `typeOf` relationships so concrete and specialized Items retain their
    semantic type hierarchy across reconciliation, persistence, and navigation.
13. [ ] Derive an operation-availability interaction view without duplicating the Operations table.
14. [ ] Add a recipient Experience that consumes the declared Operations.

## Verification

1. Source tests prove nested manifests/items are discovered without loading unrelated Markdown.
2. Snapshot tests prove Package and Entity nodes preserve source provenance and containment.
3. The Atlas graph visibly places Classroom and Enrollment Invitation under the Ontahí project.
4. `pnpm verify` passes.

## Decisions

1. Package is a semantic and implementation ownership boundary, not a synonym for Repository.
2. The special filename establishes the boundary; contained items keep the ordinary item format.
3. Explicit `parent` remains authoritative instead of inferring ownership from folder nesting.
4. Package discovery precedes a typed behavior language; this slice must not invent code generation.
5. Entity tables are authoring syntax for typed snapshot data. Statecharts and availability views
   are projections of that data, not additional Markdown artifacts maintained by authors.

## Checkpoint: Typed Entity Behavior Projection

Atlas now parses the canonical Data, Relations, States, Operations, and Invariants tables into an
`EntityModel` carried by the semantic snapshot. The Entity's States section derives a statechart
from declared transitions. The source Markdown remains visible for inspection, while the diagram
proves that the Entity anatomy is executable enough to support richer projections. Standalone
Operation Items remain the next reification boundary.

## Checkpoint: First Operation Item

Operation Model v0 separates a receiver-level behavioral index from an independently navigable
Operation contract. Enrollment Invitation's `Accept` row becomes the first linked exemplar: its
Entity retains the facts needed for state and availability projections, while the Operation Item
owns inputs, output, named failures, preserved invariants, and implementation status. Atlas does
not require this descriptive contract to be executable Ontahí code.

## Checkpoint: Semantic Item Typing

The Ontahí adoption pass exposed that `typeOf` is currently authored but discarded by Atlas.
Package containment says where an Item belongs; `kind` selects its immediate presentation; neither
expresses that Durable Operation specializes Domain Operation or that Domain Operation conforms to
the Atlas Operation model. The next bounded slice materializes direct `typeOf` edges without
inferring types from containment. Transitive membership remains traversable through the authored
chain rather than being duplicated into every Item.

The implementation now preserves direct type bindings through Markdown parsing, Ontahí-backed
projection storage, topology queries, and graph navigation. A focused chain test proves that
transitive membership is not flattened into redundant authored edges.

## Open Questions

1. Should Package later generalize into an Implementation Unit with service, application, and
   library specializations?
2. Package identity and role are authored as `packageName` and `packageType`; its repository path is
   inferred from the manifest location. Deeper `package.json` inference remains open.
3. Should packages be addressable through canonical source URIs distinct from their item ids?
4. Should the existing Ontahí Classroom example converge from School/Course/Student toward the
   Classroom/User/Enrollment model, or should the semantic experiment become a distinct example?
5. A generic Ontahí CLI should eventually discover and invoke Operations, render durable progress,
   and coalesce file-watch triggers. Atlas's command is the bounded consumer proof, not the generic
   CLI implementation.

## Closure / Evolution

This plan remains current through the Entity behavior and derived-view experiment. The manifest
slice closes independently once Package discovery and Classroom containment work end to end.
