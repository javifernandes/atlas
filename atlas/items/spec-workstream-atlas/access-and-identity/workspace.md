---
id: spec-workstream-atlas.access-identity.workspace
kind: system
title: Workspace
parent: spec-workstream-atlas.access-identity
status: active
horizon: now
supports:
  - spec-workstream-atlas.access-identity
  - spec-workstream-atlas
relatedPlans:
  - plans/done/139-workspace-members-settings.md
  - plans/done/137-workspace-ownership-v0.md
  - plans/current/136-atlas-adoption-foundation.md
---

A Workspace is Atlas's durable ownership and authorization boundary. It contains the projects,
sources, Sessions, and later Client Applications administered together, while Membership relates a
stable [[spec-workstream-atlas.access-identity.persistent-user|Persistent User]] to that Workspace.

The first implementation migrates the deployment-wide Atlas projection into one stable default
Workspace. An active Membership, not authentication alone, grants private read access. Roles begin
as `owner`, `editor`, and `viewer`; administration belongs to the Workspace owner rather than a
global Atlas administrator.

```text
User -> Membership(role, status) -> Workspace
Workspace -> Project / Source / Session / ClientApplication
```

Invitations are lifecycle records that may propose a role and delivery hint, but acceptance must
bind to the authenticated User that proves control of the invitation. Email is not Workspace
identity. Dynamic source configuration will belong to a Workspace separately from observed source
revisions and projection records.

## Evolution

Workspace ownership V0 persists the default Workspace and Memberships, gates private projection,
Runtime, and operation access, and exposes a read-only settings surface. The compatibility
projection belongs exclusively to the default Workspace until source registration introduces
per-Workspace partitions. Invitation and Membership mutation lifecycles remain the next extension.

The settings surface reads Workspace identity and active Memberships through policy-scoped Ontahí
Graph Queries over the shared Runtime Protocol. The receiver derives Principal and active
Membership as trusted authority; portable Queries do not carry a caller-selected Workspace or
role. Workspace, Membership, and member profile populations remain independently default-deny.
Atlas keeps identity and Membership as separate authorized roots until Ontahí defines policy-scope
intersection for relations materialized inside Views.
