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

Better Auth owns the physical User, Account, Session, and Verification records. Atlas owns their
repository migration, the linking policy, and the projection from the stable User ID into Ontahí.
Human OAuth tokens are not source credentials and are discarded before Account persistence;
GitHub App installation tokens remain authoritative for repository reads.
