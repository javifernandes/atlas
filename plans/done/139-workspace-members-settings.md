# 139. Workspace Members Settings

Status: done

Definition level: shaped

## Summary

Move the read-only Workspace settings experience onto Atlas's unified Ontahí Runtime Protocol.
Expose Workspace identity, the viewer's effective Membership, and active members through
policy-scoped Graph Queries, then render explicit loading, denied, failure, and ready states in the
settings surface.

## Context

Workspace Ownership V0 introduced durable Workspace and Membership records plus a server-rendered
settings page. That page currently reads SQL through an Atlas helper, while the browser Runtime
client and composed Graph policy boundary now exist. The first collaboration-facing slice should
prove those boundaries before invitations and role mutations depend on them.

Related work:

1. [`Workspace Ownership V0`](../done/137-workspace-ownership-v0.md)
2. [`Ontahí Unified Runtime Bridge`](../done/138-ontahi-unified-runtime-bridge.md)
3. [`Atlas Adoption Foundation`](../current/136-atlas-adoption-foundation.md)

## Scope

1. Define the trusted Runtime authority derived from Principal and active Workspace Membership.
2. Register default-deny Graph Read policies for Workspace, Membership, and member profile fields.
3. Declare client-side Workspace settings Queries over `/runtime`.
4. Render Workspace identity, viewer role, and active member roles.
5. Preserve the existing anonymous landing and no-membership experience.

## Non-Goals

1. No invitation creation, acceptance, expiry, or revocation.
2. No role changes, member removal, or Workspace edits.
3. No dynamic Source registration.
4. No generic multi-Workspace switcher.
5. Do not add a settings API route or client-authored authority claim.

## Proposed Form

```text
GET /settings
  anonymous / invalid auth -> existing Auth Landing
  authenticated -> WorkspaceSettings client surface
    loading -> settings skeleton
    Graph Queries /runtime
      no authorized Workspace -> No active membership
      rejected / unavailable -> recoverable settings error
      authorized -> Workspace header + active member list
```

The Runtime host derives `{ principal, workspace }` from trusted session and Membership state. The
portable Query contains no user ID, role, or Workspace authority claim. Policies intersect every
Workspace, Membership, and User population with that receiver-owned authority.

## Execution Slices

1. [x] Separate compact Workspace authority resolution from the legacy settings projection helper.
2. [x] Add Graph Read policies and application Runtime coverage.
3. [x] Add the client Query and settings interaction states.
4. [x] Retire the direct settings membership projection path where no longer needed.
5. [x] Verify default, PostgreSQL, and production-build behavior.

## Verification

1. An active member reads only their Workspace and its active memberships.
2. Member profile fields are reachable only through authorized Workspace Memberships.
3. Anonymous and non-member Runtime contexts return no Workspace data.
4. The browser sends the settings Query through `/runtime`; no custom HTTP route exists.
5. Loading, denied, failure, and ready states are covered by component tests.
6. `pnpm verify` and PostgreSQL integration tests pass.

## Decisions

1. Keep authentication and Membership resolution receiver-owned; portable Query input is not
   authority.
2. Use the first Graph reads as a read-only boundary proof before introducing collaboration
   mutations.
3. Keep Workspace identity and active Membership reads separate because nested View relations do
   not currently intersect the related policy scope; the receiver still authorizes both roots.
3. Retain the fixed default Workspace migration assumption until dynamic Source ownership requires
   multiple Workspaces.

## Closure / Evolution

Closed on 2026-10-28. Workspace Settings now reads Workspace identity and active Memberships through
the unified Runtime Protocol, with receiver-derived authority, default-deny policies, isolation
regression coverage, and explicit loading, denied, failure, and ready states. The legacy SQL member
projection was removed; server-side access resolution retains only compact Workspace authority.

The implementation discovered that related policy scopes are not currently intersected while
materializing nested View relations. Atlas therefore uses separately authorized Workspace and
Membership roots instead of treating a nested View policy as a row filter. A future Ontahí slice
can make that composition guarantee explicit before Atlas collapses these reads.

The next Atlas slice is the Invitation lifecycle, followed by owner-controlled role and Membership
mutations.
