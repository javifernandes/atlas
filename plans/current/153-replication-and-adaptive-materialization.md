# 153. Replication and incremental derivation architecture

Status: current

## Summary

Design Atlas source reconciliation as a general replication and materialization model rather than
as a sequence of GitHub-specific loader optimizations. Sources form one flat, addressable graph:
some are independently authoritative, some are Atlas-owned, and some are projections derived from
other Sources. Entities bind to those Sources by role without making storage strategy part of their
domain meaning.

This plan coordinates four narrower plans: the Source/derivation model, durable ChangeSets and
replica application, incremental Entity derivation/materialization, and Atlas editing with Git
write-back.

## Context

Atlas currently treats federated Git Markdown as authoritative input, rebuilds a PostgreSQL
projection, and persists several kinds of Atlas-owned state that cannot be reconstructed from Git.
Recent CPU containment made source observation incremental, but parsing, semantic derivation, and
publication still operate primarily as complete-set work.

Most repository changes touch fewer than ten files. Continuing to optimize the full-loader shape
would conceal the more general problem: Atlas maintains revisioned representations of state owned
elsewhere, while also owning Sessions, memberships, preferences, pending edits, and execution
history itself. Future editing from Atlas adds an outbound direction without necessarily creating
two equal authorities: Atlas can author a ChangeSet against a source revision and publish it through
a commit, branch, or Pull Request before normal observation confirms the result.

The immediate architectural pressure is incremental semantic derivation: accepted Source
ChangeSets should invalidate only affected parsed artifacts and Entities while full rebuilding
remains the equivalence oracle and repair path. Physical persistence can later become policy over
reproducible state, but cooling, eviction, and product tiers are not on the current execution path.

The generic mechanism belongs in Ontahí. It should first expose a behavioral Materializer SPI, be
proved by Atlas and then BookOps, and only then acquire a higher-level declarative API centered on
Entities. Ontahí research Plan `ontahi://plans/164-derived-models-projections-and-provenance`
provides the conceptual authority, while executable Plan
`ontahi://plans/169-replicated-versioned-models-kernel-and-materializer-spi` supplies the kernel and
behavioral SPI adopted by Plan 156.

## Research / Evidence

- `atlas_source_records`, source revisions, and Projection Revisions already preserve a first
  replica boundary and lineage.
- Plan 152 proves one Source can be re-observed while unchanged records are reused safely.
- Ontahí Task execution distinguishes durable execution lifecycle from Atlas projection lineage,
  but does not yet model the resulting source-level ChangeSet.
- The prior Beanie architecture used principal/session-attributed ChangeSets with C/U/D operations,
  granular update operators, history, and replay across replicated clients.
- Git already supplies ordered revisions, history, branching, and conflict primitives for the
  current Markdown Sources; Atlas should compose with those rather than replace them.
- Atlas-owned collaboration state demonstrates that not every Source is Git-backed or safely
  evictable.

## Scope

- Define a flat Source graph with explicit authority, derivation, revision, and Entity binding.
- Separate Unit of Work, ChangeSet, Source Revision, Projection Revision, and Session semantics.
- Define which state is canonical, derivable, Atlas-owned, ephemeral, or pending publication.
- Make incremental derivation, dependency invalidation, and full-equivalence structural and
  inspectable.
- Establish an adoption sequence from current one-way Git replication to incremental semantic
  projection and later Atlas editing/write-back.
- Preserve recovery through full observation whenever an incremental invariant cannot be proven.

## Non-Goals

- Implement a multi-master CRDT or offline merge engine in the first adoption.
- Treat every PostgreSQL table, cache entry, or serialized view as a Source.
- Require Atlas-authored edits to bypass Git review or become an independent hidden authority.
- Stabilize a declarative Ontahí Entity API before Atlas and BookOps prove the behavioral SPI.
- Implement cooling, eviction, restore tiers, or commercial policy in this execution sequence.

## Proposed Form

### Flat Source graph

Every Source has stable identity, a revision model, an observation or derivation contract, and a
declared owner. Derived Sources point to their inputs through `derivesFrom`; an Entity binds Sources
through named roles such as `definition`, `state`, `evidence`, or `activity`.

```txt
Git Markdown Source ───────┐
GitHub evidence Source ────┼─> Atlas semantic Source ─> presentation Source
Atlas Session Source ──────┘
```

A map can be convenient authoring syntax on an Entity:

```ts
sources: {
  definition: { ref: "source:bookops-markdown", selector: "bookops://atlas/book" },
  evidence: { ref: "source:bookops-github" },
}
```

Atlas normalizes that syntax into addressable Entity-to-Source binding relations. Source identity,
revision, ownership, and derivation remain first-class rather than being copied into each Entity's
opaque metadata.

### Execution and history

```txt
Session
  -> Unit of Work(principal, intent, base revisions)
       -> commands
       -> resulting ChangeSet(s)
            -> target Source Revision(s)
                 -> affected Projection Revision(s)
```

A Unit of Work is an execution/atomicity boundary and may fail without producing a ChangeSet. A
ChangeSet is the durable description of accepted changes. One Unit of Work should initially target
one Source; multi-source work remains an explicit coordination problem.

### Derivation and materialization independence

The logical revision is independent from its physical realization:

```txt
Source Revision
  -> full snapshot
  -> checkpoint + ChangeSets
  -> parsed-record artifacts
  -> remote/cold representation
  -> evicted but reproducible
```

Consumers ask for a logical revision. Policy decides whether it is already hot, must be restored,
or must be rebuilt from authoritative inputs. Non-derivable Atlas-owned state cannot be evicted
under a reconstructible-state policy.

Before those physical choices matter, a versioned Materializer should consume an exact Source
frontier and ChangeSet, reuse unchanged artifacts, invalidate affected semantic dependencies, and
publish the same logical revision as a full derivation. The behavioral SPI is the foundational
integration surface; a declarative Entity form may compile to it after multiple consumers expose
the common subset.

### Editing without immediate multi-master semantics

An Atlas edit is a principal-attributed Unit of Work against an exact base revision. Its ChangeSet
is published to the Git Source through a commit/branch/PR adapter, then ordinary observation
confirms the authoritative revision. Revision drift produces an explicit rebase/conflict outcome.

## Execution Slices

1. [x] Execute Plan 154 to settle Source identity, roles, bindings, revisions, and derivation.
2. [x] Execute Plan 155 to introduce provider-neutral ChangeSets and replica invariants in Atlas.
3. [x] Create and execute the first two slices of
       `ontahi://plans/169-replicated-versioned-models-kernel-and-materializer-spi`, then begin Plan
       156 as the Atlas adoption of its runtime kernel and behavioral Materializer SPI.
4. Adopt incremental parsed/semantic artifacts in Atlas behind full-rebuild equivalence checks and
   retain atomic Projection Revision publication.
5. Execute Plan 157 to author and publish Git-backed changes from Atlas.
6. Validate the same SPI in BookOps, then extract the shared declarative Entity API in Ontahí.

## Verification

- Every persisted state family is classified as authoritative, derived, Atlas-owned, ephemeral, or
  pending outbound state.
- The model can explain current global reconciliation and source-incremental reconciliation without
  special cases in its vocabulary.
- Full rebuild and incremental replay produce equivalent logical revisions for a fixed Source set.
- Incremental derivation invalidates all and only affected outputs, or falls back safely to a full
  rebuild when that set cannot be proven.
- Editing defines base-revision conflict behavior and attributable publication before implementation.
- Each implementation PR binds its owning subplan and the smallest durable Atlas model Item.

## Decisions

- Model Sources as a flat graph. Git-backed, Atlas-owned, and derived are roles/capabilities, not
  separate top-level object families.
- Use first-class relations for derivation and Entity bindings; allow maps/arrays only as authoring
  projections over those normalized relations.
- Keep single-authority replication as the first runtime contract while leaving room for outbound
  Atlas authorship.
- Treat the behavioral Materializer SPI as the foundational generic surface and defer the
  declarative Entity API until Atlas and BookOps reveal its stable common shape.
- Treat physical persistence as future policy when, and only when, the logical state has a proven
  reconstruction contract; do not put cooling or tiers on the immediate path.
- Represent Source as a portable Ontahí-compatible Entity and canonical receiver. Observation,
  derivation, writing, replay, and reconstruction are composable capabilities.

## Open Questions

1. Which granular update operators are needed beyond field set/unset and collection insert/remove/
   move/replace?
2. Does one ChangeSet span multiple Entity records inside one Source, while a Unit of Work
   coordinates multiple ChangeSets across Sources?
3. Which semantic dependencies can be inferred from parsing, and which must be declared?
4. Which BookOps derivation should serve as the second case before the declarative API stabilizes?
5. Which parts of derived-model lineage and incremental maintenance belong in the Ontahí kernel,
   and which remain application Materializer behavior?

## Closure / Evolution

Shaping. Plan 154 established Source as a portable Entity/receiver with capability-based behavior,
normalized Entity bindings, stable Source derivations, and exact immutable revision lineage. Plans
155 then introduced deterministic file ChangeSets, exact base/target revision application,
idempotent durable history, and snapshot fallback for gaps. Plan 156 is now the Atlas adoption of
an Ontahí-owned incremental derivation kernel/SPI, with BookOps as the second validation case before
a declarative Entity API. Plan 157 owns the remaining editing checkpoint. Cooling, eviction, and
tier policy are explicitly deferred.
