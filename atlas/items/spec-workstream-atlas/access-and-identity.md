---
id: spec-workstream-atlas.access-identity
kind: territory
title: Access And Identity
parent: spec-workstream-atlas
status: shaping
horizon: now
supports:
  - spec-workstream-atlas
  - spec-workstream-atlas.assisted-editing.operation-command-interface
relatedPlans:
  - plans/current/123-persistent-users-and-linked-accounts-v0.md
  - plans/current/119-atlas-authentication-and-workspace-visibility-v0.md
  - ontahi://plans/130-ontahi-authentication-principal-and-invocation-context
---

Access And Identity defines who or what is using Atlas, which Atlas workspace or resource is in
scope, and which operations or observations that caller may perform.

Authentication resolves a GitHub session or later machine credential into a provider-neutral
Ontahí Principal. Authorization remains an Atlas decision over that Principal, the requested action,
the workspace or nested resource, and relevant context. A GitHub App webhook signature authenticates
GitHub as an event producer; it does not authenticate the human viewing Atlas.

The first implementation keeps the existing deployment-scoped viewer and adds GitHub login plus a
coarse `public` or `private` visibility boundary. Private mode uses a stable GitHub user-ID allowlist
only as a bootstrap until the durable ownership model exists.

Atlas implements that boundary with Better Auth stateless GitHub OAuth. The Next.js host validates
the session and supplies an `atlas:better-auth` user Principal to Ontahí Runtime Protocol dispatch.
Public deployments still admit anonymous reads; private deployments require a validated allowlisted
identity for both the viewer and runtime operations. Human OAuth tokens are not retained for source
access because the Atlas GitHub App's separate installation-token flow remains authoritative for
repository access. The same App registration may identify a human through OAuth without conflating
that user session with installation or webhook authority.

The first real authorization exercises this boundary through the existing Atlas GitHub App. Atlas
requires only the App's `Email addresses: read-only` account permission for Better Auth identity;
users who authorized the App before that permission was added must approve it on reauthorization.
The deployed product boundary remains coarse and deployment-scoped until `AtlasWorkspace` is
persisted.

The first durable identity is
[[spec-workstream-atlas.access-identity.persistent-user|Persistent User]]. It has an internal Atlas
ID and one or more issuer/provider-account identities. Email remains mutable profile data rather
than an identity key: provider accounts are never silently merged only because their emails match.
An authenticated User may explicitly link another provider after proving control of it, including
when the provider returns a different email, and may not unlink the final account. Better Auth owns
the durable authentication records; Atlas owns these invariants and projects the User ID as the
subject of an `atlas` Ontahí Principal.

The intended durable containment is:

```text
User -> Membership -> AtlasWorkspace
AtlasWorkspace -> Project
AtlasWorkspace -> Source
AtlasWorkspace -> ClientApplication
```

`Project` remains a semantic root inside an Atlas workspace rather than becoming the tenancy or
authentication boundary. Client Applications authenticate as service Principals and receive
workspace- or resource-scoped grants separately from the user who registered them.
