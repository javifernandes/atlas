# 142. Workspace Administration Settings

Status: current

Definition level: shaping

## Summary

Turn Workspace Settings from a read-only adoption surface into owner-authorized administration.
Support mutable Workspace identity and visibility, GitHub repository registration, and an explicit
Danger Zone for ownership transfer and deletion without collapsing these actions into generic Graph
commands or trusting client-supplied roles.

## Context

The current page proves policy-scoped reads for Workspace, Membership, Source, and participation.
Dogfooding now exposes the missing owner workflows: `visibility` is visible but immutable, Sources
are bootstrapped from deployment configuration, and lifecycle actions do not exist.

`/atlas` is the default Workspace slug. It should become the stable human-readable address used in
future multi-Workspace routes; it is not the Source key or repository name. Slug changes therefore
need uniqueness, redirect, and permalink decisions rather than being treated as cosmetic text.

Related work:

1. [`Workspace Sources And Contributor Discovery`](140-workspace-sources-and-contributor-discovery.md)
2. [`Workspace Ownership V0`](../done/137-workspace-ownership-v0.md)
3. [`Workspace`](../../atlas/items/spec-workstream-atlas/access-and-identity/workspace.md)

## Scope

1. Add a General section for Workspace name, slug, and public/private visibility.
2. Add an owner-authorized repository connection flow backed by the GitHub App installation.
3. Add a Danger Zone for ownership transfer and Workspace deletion.
4. Define authorization, confirmation, audit, and referential-integrity behavior for every mutation.
5. Keep contributor participation distinct from Membership admission.

## Non-Goals

1. Do not expose arbitrary repository URLs without proving access through an installed provider.
2. Do not infer owner authority from a client-provided role or Workspace ID.
3. Do not delete provider installations or GitHub repositories when deleting an Atlas Workspace.
4. Do not silently change public visibility as a side effect of Source registration.
5. Do not implement organization billing or subscription ownership in this slice.

## Proposed Form

```text
Workspace Settings
  General
    name
    slug / stable address
    visibility: private | public

  Sources
    registered repositories
    Add repository -> choose GitHub installation -> choose accessible repo/ref -> confirm

  People
    Members
    Contributors to review

  Danger Zone
    Transfer ownership -> choose eligible active Member -> typed confirmation
    Delete Workspace -> dependency summary -> exact slug confirmation -> delete
```

Every mutation is a typed Workspace Domain Operation over the shared Runtime Protocol. The receiver
derives the authenticated Principal and active owner Membership. The first Atlas-specific form
resolves `Principal -> Workspace Membership -> role` in a server capability and checks the required
role inside the Operation; clients never provide trusted role state. A later Ontahí form should make
that policy declarative and allow authorization reads to participate in the same transaction as the
write rather than hiding application-specific policy inside every Operation.

Visibility changes should explain their effective boundary. Public means readable without
Membership; private means active Membership is required. Source credentials and provider
installation access remain private regardless of Workspace visibility.

## Execution Slices

### Slice 1 — General

- [x] Add owner-authorized `updateVisibility` as the first narrow administration Operation.
- [ ] Decide whether slug mutation ships now or remains immutable until Workspace routing exists.
- [x] Add pending/error/success states without replacing the policy-scoped read model.
- [ ] Extend the General Operation to name after validating the visibility authorization pattern.
- [ ] Record who changed visibility and when.

### Slice 2 — repository connection

- [ ] Add an owner-authorized `registerWorkspaceSource` Operation.
- [ ] List repositories accessible through an authorized GitHub App installation.
- [ ] Select repository and default ref, reject duplicate registrations, and trigger reconciliation.
- [ ] Add pause/remove lifecycle without deleting historical evidence.

### Slice 3 — Danger Zone

- [ ] Define transfer eligibility and guarantee that a Workspace retains exactly one owner.
- [ ] Add typed ownership transfer with explicit target and confirmation.
- [ ] Define deletion dependencies, retention, and recoverability before implementing deletion.
- [ ] Require exact slug confirmation and server-side owner reauthorization for deletion.

## Verification

- [x] Non-owners cannot invoke the visibility administration Operation.
- [ ] Visibility changes immediately affect page and Runtime access consistently.
- [ ] Repository choices are limited to installations the owner may administer.
- [ ] Duplicate or inaccessible repositories are rejected without partial registration.
- [ ] Ownership transfer cannot leave the Workspace ownerless.
- [ ] Delete presents an accurate dependency summary and cannot target another Workspace.
- [ ] Audit evidence identifies actor, Operation, target, and result.
- [ ] `pnpm verify` passes.

## Decisions

1. The slug is a stable Workspace address, not a Source identifier.
2. Repository registration is a provider-backed Operation, not a free-form URL field.
3. Visibility, transfer, and deletion require owner authority at execution time.
4. Danger Zone actions deserve dedicated Operations and confirmations rather than a generic update.

## Open Questions

1. Should changing a slug create a permanent redirect or be deferred until multi-Workspace routing?
2. Can a Workspace have multiple owners, or is transfer an atomic one-owner replacement?
3. Is Workspace deletion initially soft-delete with a retention window?
4. What remains readable as historical evidence after a Source is removed?
5. Does public visibility expose the whole Workspace graph or selected published projections?

## Closure / Evolution

In progress. The first implementation slice makes visibility editable through the Ontahí Runtime
Protocol and establishes an Atlas-specific role capability: the authenticated User is resolved to
an active Workspace Membership at execution time and only `owner` may mutate visibility. The UI's
role check is presentation only; the Operation repeats the authoritative server check.

This slice intentionally leaves an Ontahí generalization seam. Authorization lookup currently sits
behind an Atlas runtime capability and may use a database connection outside the graph mutation's
transaction. A future Ontahí policy primitive should express required Workspace capabilities and
provide one execution context for policy reads and writes before the pattern expands to Source and
Danger Zone Operations.
