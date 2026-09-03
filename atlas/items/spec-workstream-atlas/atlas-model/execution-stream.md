---
id: spec-workstream-atlas.atlas-model.execution-stream
kind: entity
title: Execution Stream
parent: spec-workstream-atlas.atlas-model
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.planning-projection.workstream-execution-tree
  - spec-workstream-atlas.access-identity.persistent-user
relatedPlans:
  - plans/current/124-implicit-personal-execution-streams-mvp.md
---

An Execution Stream is Atlas-native operational memory for one person's bounded interval of work.
It is not projected from a Markdown document and does not become semantic source merely because it
references Plans. Atlas creates, updates, and closes it through Ontahí operations over durable
PostgreSQL state.

One User may have many historical Streams but at most one open **implicit** Stream. The implicit
Stream receives attributable merged-Pull-Request activity until the User closes it. When no
implicit Stream is open, the next attributable merge with resolved Plan evidence creates one.
Explicit parallel Streams may be added later without weakening this invariant, but their activity
will require explicit routing.

A Stream stores its owning User, mode, lifecycle status, title, inferred root Plan memberships,
current-focus Plan, and lifecycle timestamps. It may accumulate several roots when one temporal
interval touches disjoint Plan families. Its activities are append-only observations such as a
merged Pull Request and its primary Plan target. Roots and focus are navigation state scoped to the
Stream; they neither own the referenced Plans nor mutate Plan lifecycle.

GitHub activity is attributable only when the event's stable provider account ID resolves through
an `AtlasAuthAccount` to an `AtlasUser`. Login, email, and display name are presentation attributes,
not identity keys. A Pull Request without an attributable User or resolved Plan evidence remains in
the shared evidence projection but does not create or move a Stream.

Closing a Stream is an explicit temporal boundary. It archives the interval while preserving
unfinished Plans and all activity. Page reads project the current Stream and a bounded recent
history directly from the database; they do not reconstruct a person's work by replaying repository
history.
