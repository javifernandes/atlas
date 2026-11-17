# 153. Replication and adaptive materialization architecture

Status: current

## Summary

Design Atlas source reconciliation as a general replication and materialization model rather than
as a sequence of GitHub-specific loader optimizations. Sources form one flat, addressable graph:
some are independently authoritative, some are Atlas-owned, and some are projections derived from
other Sources. Entities bind to those Sources by role without making storage strategy part of their
domain meaning.

This plan coordinates four narrower plans: the Source/derivation model, durable ChangeSets and
replica application, adaptive materialization policy, and Atlas editing with Git write-back.

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

The architecture should make persistence a policy over reproducible state. A Workspace projection
may remain hot, cool after inactivity, retain only checkpoints plus ChangeSets, or be evicted and
rebuilt. Those choices affect cost and latency, not the logical domain state exposed to consumers.

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
- Make materialization and retention policies structural and inspectable.
- Establish an adoption sequence from current one-way Git replication to incremental semantic
  projection and later Atlas editing/write-back.
- Preserve recovery through full observation whenever an incremental invariant cannot be proven.

## Non-Goals

- Implement a multi-master CRDT or offline merge engine in the first adoption.
- Treat every PostgreSQL table, cache entry, or serialized view as a Source.
- Require Atlas-authored edits to bypass Git review or become an independent hidden authority.
- Extract a generic Ontahí framework before Atlas proves the contracts through one real adoption.
- Make commercial tier choices before latency and storage policies have explicit semantics.

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

### Materialization independence

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

### Editing without immediate multi-master semantics

An Atlas edit is a principal-attributed Unit of Work against an exact base revision. Its ChangeSet
is published to the Git Source through a commit/branch/PR adapter, then ordinary observation
confirms the authoritative revision. Revision drift produces an explicit rebase/conflict outcome.

## Execution Slices

1. [x] Execute Plan 154 to settle Source identity, roles, bindings, revisions, and derivation.
2. [x] Execute Plan 155 to introduce provider-neutral ChangeSets and replica invariants in Atlas.
3. Execute Plan 156 to declare materialization, retention, eviction, restore, and SLO policy.
4. Adopt incremental parsed/semantic artifacts in Atlas behind full-rebuild equivalence checks.
5. Execute Plan 157 to author and publish Git-backed changes from Atlas.
6. Evaluate which proven primitives belong in Ontahí after the adoption exposes a stable boundary.

## Verification

- Every persisted state family is classified as authoritative, derived, Atlas-owned, ephemeral, or
  pending outbound state.
- The model can explain current global reconciliation and source-incremental reconciliation without
  special cases in its vocabulary.
- Full rebuild and incremental replay produce equivalent logical revisions for a fixed Source set.
- Materialization eviction cannot delete state lacking a declared reconstruction path.
- Editing defines base-revision conflict behavior and attributable publication before implementation.
- Each implementation PR binds its owning subplan and the smallest durable Atlas model Item.

## Decisions

- Model Sources as a flat graph. Git-backed, Atlas-owned, and derived are roles/capabilities, not
  separate top-level object families.
- Use first-class relations for derivation and Entity bindings; allow maps/arrays only as authoring
  projections over those normalized relations.
- Keep single-authority replication as the first runtime contract while leaving room for outbound
  Atlas authorship.
- Treat physical persistence as policy when, and only when, the logical state has a proven
  reconstruction contract.
- Represent Source as a portable Ontahí-compatible Entity and canonical receiver. Observation,
  derivation, writing, replay, and reconstruction are composable capabilities.

## Open Questions

1. Which granular update operators are needed beyond field set/unset and collection insert/remove/
   move/replace?
2. Does one ChangeSet span multiple Entity records inside one Source, while a Unit of Work
   coordinates multiple ChangeSets across Sources?
3. Which semantic dependencies can be inferred from parsing, and which must be declared?
4. What minimum checkpoint is required before a Workspace projection may be evicted safely?
5. Which policies are product tiers versus internal adaptive decisions?

## Closure / Evolution

Shaping. Plan 154 established Source as a portable Entity/receiver with capability-based behavior,
normalized Entity bindings, stable Source derivations, and exact immutable revision lineage. Plans
155 then introduced deterministic file ChangeSets, exact base/target revision application,
idempotent durable history, and snapshot fallback for gaps. Plans 156–157 own the remaining
materialization and editing checkpoints.
