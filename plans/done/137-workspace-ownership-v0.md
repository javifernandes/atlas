# 137. Workspace Ownership V0

Status: done

Definition level: shaped

## Summary

Replace Atlas's deployment-wide authenticated access with the first durable Workspace ownership
boundary. Persist one Workspace and its Memberships, migrate the current deployment into that
Workspace, require membership before loading Atlas data, and expose a small Workspace settings
surface that makes ownership visible.

Sharing, invitations, role changes, and dynamic source registration remain follow-up vertical
slices. This slice establishes the resource and authorization boundary they will extend.

## Context

Atlas already has durable provider-neutral Users and projects them as `atlas` Principals. Today any
authenticated User can read the one deployed projection, while Sessions are scoped only by User.
That is sufficient for a private personal deployment but cannot safely support collaborators or
multiple independently administered projects.

The adoption foundation identifies Workspace as the containment root for Memberships, Projects,
Sources, and Sessions. The first implementation must close the current admission gap before adding
an invitation flow: a User without Membership must not receive projection data merely because they
can authenticate.

## Research / Evidence

1. Better Auth owns User identity and Sessions; Atlas authorization must reference the stable
   `AtlasUser.id`, not provider login or email.
2. The current production corpus and source registry are deployment-scoped, so migration requires a
   deterministic default Workspace before per-Workspace source registration exists.
3. PostgreSQL already supplies checksum migrations, advisory locking, and isolated integration
   tests. Workspace bootstrap should use those boundaries rather than a separate administration
   store.
4. Atlas operations already receive an Ontahí Principal. Membership checks belong at the Atlas
   application/resource boundary and must not be inferred from hidden UI.

## Scope

1. Persist `AtlasWorkspace` and `AtlasWorkspaceMembership` with a compact role vocabulary.
2. Create one stable default Workspace for the current deployment.
3. Assign the oldest existing persistent User as owner during migration; if no User exists, let the
   first authenticated User claim ownership atomically.
4. Require an active Membership before loading the private Atlas projection.
5. Keep public local-development mode available as an explicit non-production bypass.
6. Expose the current Workspace name, slug, viewer role, and member list in a small settings page.
7. Prove unauthorized and cross-Workspace denial in PostgreSQL integration tests.

## Non-Goals

1. Do not add invitations, email delivery, role editing, removal, or ownership transfer yet.
2. Do not add dynamic source registration or move source credentials into Workspace records yet.
3. Do not scope every persisted projection row by `workspace_id` in this first migration; the
   default Workspace owns the existing deployment projection as one compatibility partition.
4. Do not introduce global administrators or use Better Auth roles as Atlas authorization.
5. Do not use email as a Membership identity key.

## Proposed Form

```text
AtlasUser
  -> AtlasWorkspaceMembership { role: owner | editor | viewer, status: active }
      -> AtlasWorkspace { id, slug, name, visibility }
          -> current deployment projection (compatibility ownership)
```

Private request flow:

```text
validated Atlas User
  -> resolve active Membership
      -> load Workspace-scoped page data
      -> expose Workspace identity and role to Settings

no Membership
  -> deny before projection loading
```

The default Workspace ID and slug are stable migration constants. Bootstrap is serialized in
PostgreSQL: an existing oldest User receives owner Membership during migration; otherwise the first
authenticated User claims it with an insert guarded by the absence of any Membership.

## Execution Slices

1. [x] Add the Workspace/Membership migration, Ontahí Entities, mappings, and durable Atlas item.
2. [x] Add atomic default-Workspace bootstrap and membership resolution in PostgreSQL.
3. [x] Gate private page, Runtime, and operation access before projection reads or dispatch while
   preserving explicit public local mode.
4. [x] Add a small authenticated Workspace settings route with owner/member visibility.
5. [x] Add focused authorization, migration, page, route, and PostgreSQL isolation coverage.
6. [x] Run full verification and record the invitation/sharing follow-up boundary.

## Verification

1. Migrations are idempotent and preserve the current projection and authentication records.
2. The oldest existing User owns the default Workspace, or the first authenticated User claims it
   atomically when no User existed at migration time.
3. An authenticated User without Membership cannot trigger projection loading.
4. An owner can load Atlas and view Workspace settings and active members.
5. Membership lookup uses the stable User ID and never provider login or email.
6. Public local-development mode retains its deliberate anonymous behavior.
7. `pnpm verify`, `pnpm test:postgres`, and `git diff --check` pass.

## Decisions

1. Roles begin as `owner`, `editor`, and `viewer`; only `owner` has administration capability in
   this slice.
2. Administration is Workspace-scoped. Atlas has no global administrator role.
3. The compatibility projection belongs to the default Workspace until dynamic source
   registration introduces true per-Workspace source partitions.
4. Settings follows the authorization model; it does not define it.
5. Invitation tokens and acceptance are a separate vertical slice after ownership denial is proven.

## Open Questions

1. Should a later Workspace URL use `/w/:slug`, or should the root continue to select the sole
   Workspace until a User belongs to more than one?
2. Should the first sharing slice allow owners to invite both editors and viewers, or begin with
   viewer-only invitations?
3. When source registration lands, should one Source belong to exactly one Workspace or be mounted
   through explicit grants?

## Checkpoint — 2026-10-25

Workspace ownership V0 landed as a complete vertical slice. Migration `011` creates one stable
default Workspace and active role-bearing Memberships, promotes the oldest existing User when
available, and otherwise lets the first authenticated User claim ownership under an advisory lock.
The compatibility projection is deliberately owned only by that default Workspace: membership in
another Workspace does not grant access to it.

Private page reads, Runtime Protocol requests, and operation invocations now require active default
Workspace membership. Public local mode remains an explicit bypass. `/settings` exposes Workspace
identity, visibility, the viewer's role, and active members without yet offering mutations.

Verification passed with `pnpm verify`, `pnpm test:postgres` (11 tests), and `git diff --check`.

## Closure / Evolution

Closed after the ownership boundary, bootstrap, denial paths, and read-only settings surface were
implemented and verified. The next focused slice is invitations and Membership administration:
invite creation/acceptance, role changes, suspension/removal, and ownership-transfer invariants.
Dynamic source registration remains the following ownership-dependent slice; it should introduce
real per-Workspace source and projection partitions rather than weakening this compatibility
boundary.
