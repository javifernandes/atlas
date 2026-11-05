# 143. Dynamic Workspace Onboarding

Status: current

Definition level: implementation

## Summary

Replace Atlas's canonical-Workspace assumption with an authenticated onboarding flow where a User
can create and enter Workspaces dynamically. Preserve the existing Atlas Workspace and its Sources
as migrated tenant data while ensuring new Users never claim it implicitly.

## Context

Atlas already persists Workspaces, Memberships, and Workspace-owned Sources, but request access,
routing, local compatibility, and several fixtures still select one fixed Workspace UUID. The
oldest persisted User was backfilled as its owner and later sign-ins may claim it when no Membership
exists. That compatibility behavior prevents Atlas from becoming adoptable by unrelated projects.

The first multi-Workspace slice does not need a general authorization framework. It needs a narrow
rule: an authenticated User may create a Workspace, creation atomically grants that User its owner
Membership, and subsequent reads derive the selected Workspace through active Membership.

Related work:

1. [`Atlas Adoption Foundation`](136-atlas-adoption-foundation.md)
2. [`Workspace Administration Settings`](142-workspace-administration-settings.md)
3. [`Workspace`](../../atlas/items/spec-workstream-atlas/access-and-identity/workspace.md)

## Scope

1. List every active Workspace Membership for the authenticated User.
2. Show onboarding when the User has no Workspace.
3. Create Workspace and owner Membership atomically from a name and unique slug.
4. Route selected Workspaces by stable slug and carry that selection into Runtime Protocol calls.
5. Preserve the existing Atlas Workspace and Source rows as backfilled tenant data.
6. Rename the unused `editor` role to the product vocabulary `collaborator`.

## Non-Goals

1. Do not add a general Ontahí authorization primitive.
2. Do not register repositories dynamically in this slice.
3. Do not implement invitations, ownership transfer, deletion, or BYOK.
4. Do not expose the existing Atlas projection to a newly created empty Workspace.
5. Do not automatically create one Workspace per historical User.

## Proposed Form

```text
GitHub User
  -> active Memberships?
       none -> Create Workspace -> Workspace + owner Membership
       some -> Workspace home -> choose Workspace -> /w/:slug

/w/:slug
  -> resolve authenticated User + active Membership
  -> selected Workspace authority
  -> Runtime Graph reads and Operations scoped to that Workspace
```

The canonical Atlas Workspace remains an ordinary migrated Workspace with slug `atlas`. New Users
without Membership see onboarding rather than `No active membership`, and they cannot observe the
Atlas projection. Until dynamic Source registration lands, a newly created Workspace renders an
empty-state handoff rather than another tenant's content.

The authenticated root is a Workspace home rather than an implicit redirect. It lists every active
Membership as a project card and exposes creation as a peer action. Inside a Workspace, a compact
control links back to that home, switches directly to another Workspace, or opens Settings.

## Execution Slices

### Slice 1 — persistence and creation

- [x] Remove implicit claiming of the canonical Atlas Workspace in persistent storage.
- [x] Add active Workspace listing by User.
- [x] Add typed `createWorkspace` Domain Operation over the shared Runtime Protocol.
- [x] Create Workspace plus owner Membership in one graph transaction.
- [x] Migrate `editor` Membership rows and constraints to `collaborator`.

### Slice 2 — routing and onboarding

- [x] Add no-Membership onboarding that derives a unique server-validated slug from the Workspace name.
- [x] Add `/w/:slug` and `/w/:slug/settings` routes.
- [x] Carry the selected slug into Runtime requests and resolve it against active Membership.
- [x] Add a compact Workspace selector for Users with multiple Memberships.
- [x] Add an authenticated Workspace home and a persistent return affordance from each Workspace.
- [x] Keep an empty Workspace isolated from the canonical Atlas projection.

### Slice 3 — compatibility and evidence

- [x] Preserve the existing Atlas Workspace, owner, and registered Sources.
- [x] Redirect compatible legacy entry points into Workspace routes.
- [x] Record implementation discoveries in this Plan and the durable Workspace item.

## Verification

- [x] A signed-in User without Membership can create a Workspace and becomes its owner.
- [ ] Duplicate or invalid slugs fail without leaving a Workspace or Membership behind.
- [x] A later persistent User does not claim the existing Atlas Workspace.
- [x] A User can select each Workspace for which they have active Membership.
- [x] A User cannot select a Workspace by guessing another tenant's slug.
- [x] Runtime Graph reads carry the selected route slug into Membership-scoped authority.
- [x] A new empty Workspace does not render the Atlas/BookOps/Ontahí projection.
- [x] Existing Atlas Workspace data remains reachable by its current owner.
- [x] `pnpm verify` passes.

## Decisions

1. Workspace creation is available to any authenticated User; it has no prior Workspace authority.
2. The creator receives the sole initial `owner` Membership atomically.
3. New Users receive onboarding, never implicit access to the migrated Atlas Workspace.
4. The first role vocabulary is `owner`, `collaborator`, and `viewer`; capability differences may
   remain small until Atlas gains more mutation surfaces.
5. Atlas keeps explicit server-side checks for this slice and defers Ontahí policy generalization.

## Open Questions

1. Should the canonical Atlas projection be generalized immediately or remain a compatibility
   tenant until repository registration and per-Workspace reconciliation land?
2. Should Workspace slug changes create aliases once routes become externally shareable?
3. Does the first selector live in the current fixed Workspace control or a dedicated account menu?

## Closure / Evolution

In progress. Atlas now creates Workspace plus owner Membership through one typed Operation and graph
transaction, routes selected Workspaces by slug, scopes Runtime requests through active Membership,
and provides a Workspace home, selector, and explicit new-Workspace route. The creation UI treats
the slug as a derived Workspace URL rather than a second naming concept; the server remains the
authority for global uniqueness. The migrated Atlas tenant alone renders
the compatibility projection; other Workspaces remain empty rather than observing its data.

Persistent access no longer auto-claims the Atlas Workspace. Memory mode intentionally retains its
canonical ephemeral owner compatibility and additionally registers newly created Workspaces in a
process-local registry, so local development can exercise multi-Workspace UX without pretending to
provide durable tenancy. PostgreSQL integration coverage was updated, but the local integration run
could not start because no container runtime was available; unit, routing, and Operation coverage
still exercise the new boundary.

Dogfooding exposed a local cold-start coupling: the first Workspace administration Operation waited
for memory composition to load Markdown plus remote merged-PR evidence, taking roughly 27 seconds
while later Runtime requests completed in tens of milliseconds. Atlas now prewarms memory
composition when an authenticated User reaches Workspace home or onboarding and makes the delayed
state explicit in the creation control. This is a mitigation, not the durable boundary: onboarding
and administration should eventually start independently from the repository projection read
model.

The Source step now behaves as a multi-repository picker rather than a single-selection form. Each
GitHub repository owns its `Add`/pending/added state, successful additions remain visible in place,
and a separate `Continue` action closes the Source step. The temporary completion surface is honest
that Workspace LLM configuration is still a later security slice; the target onboarding sequence is
Workspace identity -> Sources -> optional Model Connection -> summary -> open Workspace.
