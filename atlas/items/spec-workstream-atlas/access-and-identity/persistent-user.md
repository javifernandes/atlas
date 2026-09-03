---
id: spec-workstream-atlas.access-identity.persistent-user
kind: entity
title: Persistent User
parent: spec-workstream-atlas.access-identity
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.access-identity
relatedPlans:
  - plans/current/123-persistent-users-and-linked-accounts-v0.md
  - plans/current/119-atlas-authentication-and-workspace-visibility-v0.md
---

A Persistent User is Atlas's durable identity for one human across login providers. Its internal
generated ID is the subject of the `atlas` user Principal and the future target of workspace
ownership and membership. Email, name, and image are mutable profile attributes; email is neither
the primary key nor sufficient evidence that independently authenticated accounts belong to the
same User.

The User may have multiple Auth Accounts. An Account identifies an external login by its stable
issuer and provider-owned account ID. A first successful sign-in creates both records; a known
Account resolves its existing User. Atlas disables implicit same-email linking. A signed-in User
may explicitly link another provider after proving control of that identity, even when it presents
a different email, and may not unlink the final Account.

Better Auth owns writes to the physical User, Account, Session, and Verification records through
Atlas's shared PostgreSQL Pool. Ontahí reflects the same User and Account rows as the server-only
`AtlasUser` and `AtlasAuthAccount` Entities, including their one-to-many relation, so later
workspace ownership and membership can use real Entity relations without duplicating identity
state. Session and Verification remain authentication infrastructure rather than domain Entities.

The Ontahí Account shape contains only its internal ID, stable provider identity, User reference,
and lifecycle timestamps. Passwords and provider tokens are outside the Entity entirely. Atlas
owns the repository migration, linking policy, and projection from the stable User ID into an
Ontahí Principal. Human OAuth tokens are discarded before Account persistence; GitHub App
installation tokens remain authoritative for repository reads.
