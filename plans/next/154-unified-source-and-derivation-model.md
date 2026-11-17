# 154. Unified Source and derivation model

Status: next

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

## Execution Slices

1. Inventory and classify current state and lineage tables.
2. Define Source, Source Revision, Source Binding, and Derivation relations.
3. Test the model against Git Markdown, GitHub evidence, Sessions, and semantic projection.
4. Define authoring syntax and normalized Ontahí/Atlas representation.
5. Record migration compatibility with current Workspace Sources.

## Verification

- No existing state family requires a Git-specific field in the core Source contract.
- Derived revisions name exact input revisions.
- Entity bindings can express multiple Sources per role and one Source across many Entities.
- The model does not classify an arbitrary table as a Source without observation/derivation and
  revision semantics.

## Closure / Evolution

Not started. Parent: `plans/current/153-replication-and-adaptive-materialization.md`.
