# 154. Unified Source and derivation model

Status: done

## Summary

Define the provider-neutral Source model that lets authoritative, Atlas-owned, and derived state
participate in one revisioned graph. Specify normalized Entity bindings and Source-to-Source
derivation while preserving a compact map/array authoring form.

## Context

The current model spreads source identity across registries, Workspace Source rows, normalized
records, source revisions, Entity provenance, evidence providers, and Projection Revisions. Git is
only one provider. Sessions, memberships, pending edits, and future derived semantic artifacts have
different ownership and reconstruction characteristics.

## Scope

- Source identity, owner, provider, revision scheme, capabilities, and lifecycle.
- `derivesFrom` relations and exact revision lineage.
- Entity-to-Source bindings with named roles and selectors.
- Classification of existing Atlas state families.
- Criteria distinguishing a Source from an implementation table or disposable cache.
- Authoring syntax and its normalized graph representation.

## Non-Goals

- ChangeSet execution or persistence.
- Eviction algorithms.
- Git write-back UI.

## Proposed Form

A Source is addressable state that has either an observation contract or a derivation contract and
can name the revision being consumed. Provider and ownership are attributes/capabilities. A derived
Source records both its dependency Sources and the exact revisions used for each produced revision.

Entity source metadata is authoring syntax for normalized bindings:

```ts
sources: {
  definition: [{ ref: "source:atlas-markdown", selector: "atlas://atlas/model/entity" }],
  evidence: [{ ref: "source:atlas-github" }],
}
```

The map key is a binding role, not a storage slot. Atlas may reflect these bindings from Entity
declarations, provider observations, or both, while recording provenance for each binding.

### Entity and receiver identity

`Source` is an Ontahí-compatible Entity, not merely an annotation on another Entity. Operations
such as observe, reconcile, apply ChangeSet, pause, restore, or publish receive a portable
`SourceRef`. Provider-specific locators remain behind adapters; domain operations do not accept a
repository string or structurally similar `{ id }` object in place of semantic receiver identity.

`AtlasWorkspaceSource` is the current adoption precursor: it records desired Workspace Source
configuration and already has stable Entity identity. It may migrate into, or bind one-to-one with,
the provider-neutral Source Entity without making Workspace registration itself the observed
revision.

### Source capabilities

Source kinds are not a closed inheritance hierarchy. One Source may declare several capabilities:

| Capability | Contract |
| --- | --- |
| `observable` | An adapter can resolve the current or requested provider revision. |
| `derivable` | A deterministic transformation can produce a revision from exact input revisions. |
| `writable` | An authorized Unit of Work may propose or apply a ChangeSet. |
| `replayable` | A checkpoint and ordered accepted ChangeSets can reconstruct a revision. |
| `reconstructible` | Declared inputs and transformation can reproduce state after eviction. |

Authority and ownership remain explicit Source relations/metadata. `external`, `Atlas-owned`, and
`derived` describe who accepts revisions and how they arise; they do not create separate Source
families.

### Revision and derivation

`SourceRevision` is immutable and belongs to exactly one Source. Its provider revision key is opaque
to the core model and qualified by a scheme such as `git`, `content-sha256`, or an Atlas sequence.
The Source identifies its accepted head; history remains append-only.

Derivation has two levels:

1. `SourceDerivation` declares that an output Source depends on input Sources through a named,
   versioned transformation.
2. `SourceRevisionInput` records the exact input Source Revisions consumed by one output revision.

The declared Source dependency graph is acyclic in the first runtime. Exact revision lineage is
always acyclic and immutable. Rebuilding the same transformation version from the same ordered
input revisions must yield equivalent logical content even if its materialization differs.

### Entity bindings

`SourceBinding` is a normalized many-to-many relation from a subject Entity Ref to a Source Ref.
It carries a stable role, an optional adapter selector, provenance, and optional revision validity.
The Entity `sources` map is authoring sugar. Every value is an array, even when a role currently has
one Source, so cardinality does not change the shape later.

### Existing-state classification

| Current state | Unified reading |
| --- | --- |
| Workspace Source registration | Desired Source configuration / provider binding |
| Git Markdown corpus | Observable, writable external-authority Source |
| GitHub PR evidence | Observable external-authority Source |
| normalized source records | Materialization of one Source Revision |
| semantic Item/Plan graph | Derived Source |
| Projection Revision snapshot | Derived Source Revision/materialization |
| memberships and Sessions | Atlas-owned durable Sources once revision semantics are explicit |
| imports and Task runs | Execution history, not Source state by themselves |
| caches and server traces | Materializations or packaging, not Sources |
| pending outbound edits | Atlas-owned pending state, not an accepted external Source Revision |

This classification is semantic rather than table-driven. A table becomes an implementation of a
Source, revision, binding, or execution record; its existence never grants Source identity.

## Execution Slices

1. [x] Inventory and classify current state and lineage tables.
2. [x] Define Source, Source Revision, Source Binding, and Derivation relations.
3. [x] Test the model against Git Markdown, GitHub evidence, Sessions, and semantic projection.
4. [x] Define authoring syntax and normalized Ontahí/Atlas representation.
5. [x] Record migration compatibility with current Workspace Sources.

## Verification

- No existing state family requires a Git-specific field in the core Source contract.
- Derived revisions name exact input revisions.
- Entity bindings can express multiple Sources per role and one Source across many Entities.
- The model does not classify an arbitrary table as a Source without observation/derivation and
  revision semantics.

## Decisions

1. Source is a portable Entity/receiver; capabilities describe how it is observed, derived,
   written, replayed, or reconstructed.
2. Entity bindings normalize to many-to-many relations. A role-keyed map is authoring syntax only.
3. Stable Source derivation and exact revision lineage are separate relations.
4. Provider revision values are opaque qualified keys; core identity does not assume Git SHA.
5. Source revisions are immutable. Mutable desired configuration and execution lifecycle remain
   separate records.
6. Initial derivations form a DAG. Cyclic reactive systems require a later consistency model.

## Open Questions

1. Should provider-neutral `Source` replace `AtlasWorkspaceSource`, or should registration bind to a
   separately reusable Source shared across Workspaces?
2. Which selector forms deserve portable structure versus adapter-owned opaque values?
3. Does Atlas-owned Session state need Source semantics immediately, or only when replay,
   derivation, or materialization policy consumes it?
4. Which transformation version identity belongs in Source declarations versus deployment/runtime
   provenance?

## Closure / Evolution

Model contract completed. The durable Source, Source Revision, Source Binding, and Source
Derivation Items now own the accepted form. Plan 155 may introduce ChangeSets against `SourceRef +
baseRevision` without deciding provider or materialization details. Physical schema migration and
Workspace Source unification remain adoption work, not hidden requirements of this modeling pass.
