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
  - plans/current/143-dynamic-workspace-onboarding.md
  - plans/current/142-workspace-administration-settings.md
  - plans/current/141-read-only-plan-assistant.md
  - plans/current/140-workspace-sources-and-contributor-discovery.md
  - plans/done/139-workspace-members-settings.md
  - plans/done/137-workspace-ownership-v0.md
  - plans/current/136-atlas-adoption-foundation.md
---

A Workspace is Atlas's durable ownership and authorization boundary. It contains the projects,
sources, Sessions, and later Client Applications administered together, while Membership relates a
stable [[spec-workstream-atlas.access-identity.persistent-user|Persistent User]] to that Workspace.

The first implementation migrates the deployment-wide Atlas projection into one stable default
Workspace. An active Membership, not authentication alone, grants private read access. Roles begin
as `owner`, `collaborator`, and `viewer`; administration belongs to the Workspace owner rather than a
global Atlas administrator.

```text
User -> Membership(role, status) -> Workspace
Workspace -> Project / Source / Session / ClientApplication
```

Invitations are lifecycle records that may propose a role and delivery hint, but acceptance must
bind to the authenticated User that proves control of the invitation. Email is not Workspace
identity. Dynamic source configuration will belong to a Workspace separately from observed source
revisions and projection records.

A Workspace Source may also yield observed contributor candidates. Those candidates are a scoped
[[spec-workstream-atlas.atlas-model.participation|Participation]] projection, not Memberships.
Repository activity may nominate a provider identity for invitation or approval, but it cannot grant
Workspace access without the configured admission policy and a proven link to an Atlas User.

## Evolution

Workspace ownership V0 persists the default Workspace and Memberships, gates private projection,
Runtime, and operation access, and exposes a read-only settings surface. The compatibility
projection belongs exclusively to the default Workspace until source registration introduces
per-Workspace partitions. Invitation and Membership mutation lifecycles remain the next extension.

The next adoption slice introduces Workspace-owned Source registrations before invitation
mutations, then derives contributors from attributable provider evidence. Members, invitations, and
observed contributors remain visibly separate populations in settings. The default contributor
admission policy requires owner approval; any later automatic admission is limited to a viewer role
and a proven linked provider account.

The settings surface reads Workspace identity and active Memberships through policy-scoped Ontahí
Graph Queries over the shared Runtime Protocol. The receiver derives Principal and active
Membership as trusted authority; portable Queries do not carry a caller-selected Workspace or
role. Workspace, Membership, and member profile populations remain independently default-deny.
Atlas keeps identity and Membership as separate authorized roots until Ontahí defines policy-scope
intersection for relations materialized inside Views.

Model configuration is also Workspace-shaped administration, but provider credentials are not
ordinary Workspace fields. The first Plan assistant uses server deployment configuration while the
future BYOK form should bind a Workspace to encrypted secret material or a host secret reference,
safe provider/model metadata, usage policy, and explicit capability grants. Model execution never
inherits Workspace access from a caller-supplied ID; Atlas reauthorizes the authenticated User's
active Membership at the Operation boundary.

When Atlas runs locally without PostgreSQL, an authenticated in-memory User receives ephemeral
owner authority over the same canonical default Workspace. This is a development compatibility
form, not persisted Membership or a deployed admission policy; configuring `DATABASE_URL` restores
the durable Membership requirement.

Workspace administration evolves beyond the current read model through explicit owner-authorized
Operations. General identity and visibility, dynamic Source registration, and destructive lifecycle
actions remain separate interaction zones with progressively stronger confirmation and invariant
requirements. The Workspace slug is its stable human-readable address, not a repository Source key.

The first mutation form resolves `Principal -> active Membership -> role` through a server-only
Atlas capability and requires `owner` inside the Workspace Operation. Client role state may disable
controls for clarity but never grants authority. This is the application-level precursor to a
future Ontahí policy model where Operations declare required capabilities and the runtime can keep
authorization reads and mutations within one execution boundary.

Workspace selection is dynamic per authenticated User rather than deployment-global. A User with no
active Membership creates a Workspace and receives its owner Membership in the same transaction;
new identities never claim the migrated Atlas Workspace implicitly. Stable slug routes select a
candidate Workspace, but the server admits that selection only when an active Membership links the
current Principal to it. The original `/atlas` data remains ordinary backfilled tenant data while
new Workspaces begin empty until they register their own Sources.

An owner registers a GitHub Source only through a server-authorized Workspace Operation. Atlas
discovers repositories through the authenticated User's incrementally authorized provider account,
derives the Source key and default branch from canonical repository metadata, and rejects both
duplicates and caller-forged repository names outside that provider list. Delegated provider tokens
are encrypted at rest and never cross the Runtime Protocol. Registration records desired configuration;
turning it into a Workspace-partitioned Plan and Item projection remains a separate reconciliation
responsibility.

The route-resolved Membership is also the presentation authority for owner controls. A missing User
profile join may degrade member presentation, especially in local memory mode, but it never erases
the creator's owner role or disables authorized administration. Provider installation authority is
separate: it governs which repositories Atlas may read, not who owns the Workspace.

Workspace deletion is an owner-authorized lifecycle Operation over the Workspace aggregate. It
requires the authenticated owner to repeat the exact Workspace slug, removes Memberships, Sources,
and derived Contributors with the Workspace, and leaves the Atlas User, GitHub repositories, and
provider authorization untouched. The first form is immediate rather than recoverable in-product;
durable deployments rely on database backup until retention and restoration become explicit model
concepts.
