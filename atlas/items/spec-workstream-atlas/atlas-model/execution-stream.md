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
  - plans/done/124-implicit-personal-execution-streams-mvp.md
  - plans/done/125-explicit-session-forking-and-routing.md
  - plans/done/126-session-archival-and-activity-recency.md
---

An Execution Stream is Atlas-native operational memory for one person's bounded interval of work.
It is not projected from a Markdown document and does not become semantic source merely because it
references Plans. Atlas creates, updates, and closes it through Ontahí operations over durable
PostgreSQL state.

One User may have many historical Streams, at most one open **implicit** Stream, and several open
**explicit** Streams. The implicit Stream receives attributable untagged merged-Pull-Request
activity until the User closes it. When no implicit Stream is open, the next attributable untagged
merge with resolved Plan evidence creates one. Explicit Streams receive activity only through an
`Atlas-Session` directive naming that exact open Stream.

A Stream stores its owning User, mode, lifecycle status, title, root Plan memberships,
current-focus Plan, optional `forkedFrom` Stream, and lifecycle timestamps. `lastActivityAt` is the
durable maximum merged-PR activity time, maintained as an ingestion summary so bounded activity
hydration never makes recency inaccurate. An implicit Stream may
accumulate several inferred roots when one temporal interval touches disjoint Plan families. An
explicit Stream begins with the exact Plans selected during a fork; the source Stream and its PR
history remain unchanged, and the new Stream starts without copied activity. A merged Pull Request
retains one primary Plan as focus and activity. Activities remain append-only observations rather
than one synthetic activity per target. Roots, lineage, and focus are navigation state scoped to
the Stream; they neither own the referenced Plans nor mutate Plan lifecycle.

GitHub activity is attributable only when the event's stable provider account ID resolves through
an `AtlasAuthAccount` to an `AtlasUser`. Login, email, and display name are presentation attributes,
not identity keys. A Pull Request without an attributable User or resolved Plan evidence remains in
the shared evidence projection but does not create or move a Stream.

Session routing is operational metadata, not semantic evidence. `Atlas-Session: <session-id>`
targets one open Stream owned by the PR author. A malformed, unknown, closed, or differently owned
explicit target records no Stream activity and never falls back to the implicit Stream. Without
the directive, the implicit behavior remains compatible. `Atlas-Implements` and `Atlas-Shapes`
continue to resolve Plan and Item evidence independently.

Closing a Stream is an explicit temporal boundary. Archiving is a separate, reversible curation
state recorded by nullable `archivedAt`; it can hide an open or closed Stream without changing
activity routing. Newly routed merged-PR activity clears `archivedAt` in the same transaction so
an active Stream resurfaces automatically. A closed Stream remains unroutable and unarchiving it
does not reopen activity routing. Both mutations are bridged Ontahí operations carried by the
generic Operation adapter and dispatcher also used by Atlas's Runtime Protocol; the operation
derives the User from the authenticated Principal and never accepts a client-asserted owner
identity. Its declared requirement admits only an Atlas user Principal, keeping permission checks
aligned with execution. Fork is likewise an ownership-checked bridged operation and creates the new
Stream plus selected root memberships transactionally. Close ends one interval while preserving
unfinished Plans and all activity. Page reads project open Streams, bounded recent unarchived
history, and a bounded archive directly from the database; they do not reconstruct a person's work
by replaying repository history.
