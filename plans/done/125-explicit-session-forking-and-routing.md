# 125. Explicit Session Forking And Activity Routing

Status: done

Definition level: shaped

Parent plan: [Implicit Personal Execution Streams MVP](./124-implicit-personal-execution-streams-mvp.md)

**Predecessor:**

- [`124-implicit-personal-execution-streams-mvp.md`](124-implicit-personal-execution-streams-mvp.md)

## Summary

Extend Atlas Sessions from one implicit personal Execution Stream into multiple simultaneous
personal Sessions. A User can select Plans in one Session, fork them into a new explicit Session,
switch between open Sessions, and copy the stable Session instruction that an LLM chat must
preserve in every Pull Request body:

```text
Atlas-Session: <session-id>
```

Merged Pull Requests carrying that directive are attributed only to the named open Session owned
by their author. Invalid explicit routing never falls back to another Session. Pull Requests
without the directive retain the existing implicit-session behavior for compatibility.

This plan implements the **Workstream Execution Tree** and shapes the **Execution Stream**.

## Context

Plan 124's longer-tree dogfood showed the intended behavior and the missing boundary at the same
time. One coherent line of work moved from Relationship semantics into Runtime Protocol
foundations, while Atlas Sessions work proceeded as a separate product front. A single implicit
Session can preserve the history, but cannot represent those simultaneous fronts honestly.

The immediate need is not MCP or autonomous chat identity. It is a durable Session identity, an
explicit fork transition, and a small copyable contract that lets any LLM chat declare where its
future PR activity belongs.

## Scope

### In scope

- add stable explicit Session identity to the user-facing Sessions workspace;
- allow a User to select one or more Plans from a Session tree and fork them into a new explicit
  open Session;
- preserve the source Session and its existing activity unchanged;
- persist `forkedFrom` lineage between Sessions;
- allow multiple explicit Sessions to remain open simultaneously;
- allow switching between open and recent Sessions in the workspace;
- expose copyable LLM instructions containing the Session title, Session ID, and exact
  `Atlas-Session` PR directive;
- parse `Atlas-Session` independently from Atlas evidence bindings;
- route a merged PR with a valid directive to that exact open Session when it is owned by the PR
  author;
- refuse implicit fallback when an explicit directive is invalid, closed, or belongs to another
  User;
- retain current implicit-session attribution for merged PRs without a directive;
- document the routing contract, ownership rule, and bootstrap limitations.

### Out of scope

- MCP integration or chat/task registration;
- discovering a Session from branch names, commit messages, changed files, or semantic similarity;
- automatic copying of prior PR activity into a fork;
- assigning collaborators or multiple owners to one Session;
- moving or removing Plans after a fork;
- an inbox for invalid or ambiguous routing;
- retries, background repair, or historical rerouting of Pull Requests;
- replacing explicit `Implements` and `Shapes` evidence bindings;
- cross-User or organization-wide Sessions.

## Durable semantics

### Fork

Given an owned source Session and a non-empty selection of Plans visible in its projected tree,
Atlas creates a new Session with:

- `mode = explicit`;
- `status = open`;
- exact selected Plans as roots;
- the first selected Plan as initial focus;
- `forkedFromStreamId = <source-session-id>`;
- no copied PR activities.

The source Session remains open and unchanged. Fork is an explicit transition, not a split or move.

### PR routing

Routing is deterministic:

1. Resolve the merged PR author to an Atlas User.
2. Resolve its explicit Plan evidence as today.
3. If the body contains one well-formed `Atlas-Session: <uuid>` directive, target only that open
   Session when it belongs to the author.
4. If that explicit target is missing, closed, or not owned by the author, record no Session
   activity and do not fall back.
5. If there is no Session directive, retain the existing one-open-implicit-Session behavior.

One merged PR remains attributable to at most one Session.

## Execution slices

1. [x] Define and test the Session directive parser, fork contract, lineage projection, and exact
       selected-root semantics.
2. [x] Add the persistence migration for Session lineage and explicit-directive activity
       attribution.
3. [x] Implement the authenticated fork Operation with ownership and source-tree membership
       checks.
4. [x] Route merged Pull Requests by `Atlas-Session`, including proof that invalid explicit routing
       never falls back.
5. [x] Add Session switching, Plan selection, fork creation, lineage context, and copyable LLM
       instructions to the Sessions workspace.
6. [x] Update Atlas items, Plan 124 closure, documentation, and README; run focused and complete
       verification.

## Test strategy

- parser tests cover absent, valid, malformed, duplicate, and whitespace/case behavior;
- pure model tests cover selected roots, source-tree membership, and lineage projection;
- Operation tests cover authentication, ownership, empty selection, invalid selection, and
  successful fork without copied activities;
- Postgres integration tests cover valid explicit routing, untagged implicit compatibility,
  closed/not-owned/unknown directives, and PR deduplication;
- UI tests cover switching Sessions, selecting Plans, forking, and copying exact LLM
  instructions;
- migration verification covers forward application on an existing database;
- full typecheck, lint, format, unit/integration suites, build, and artifact checks run proportionally before closure.

## Acceptance criteria

- a User can keep at least two explicit Sessions open and inspect each independently;
- forking selected Plans does not mutate the source Session or copy its PR history;
- the new Session exposes a stable ID and a one-click LLM instruction;
- a merged PR with `Atlas-Session: <id>` is visible only in the matching owned open Session;
- a malformed or unauthorized explicit target cannot be silently attributed to the implicit Session;
- an untagged PR continues to use the implicit Session path;
- authorization remains exclusively server-side;
- the Atlas ontology and planning projection describe the new semantics without treating a chat or
  LLM as the Session identity.

## Decisions

- **Session is the product term; Execution Stream remains the model name.** This preserves the
  existing ontology while using the language already established in the workspace.
- **Fork copies context, not history.** The source records what happened; the fork declares what
  work continues separately.
- **Explicit routing is fail-closed.** Once a PR declares a Session, Atlas never guesses another destination.
- **Untagged routing remains implicit.** This preserves the personal MVP and permits gradual adoption.
- **The PR directive is operational metadata, not ontology evidence.** `Atlas-Session` routes
  activity; `Implements` and `Shapes` continue to bind evidence.
- **No MCP in this slice.** The copied instruction is the smallest portable handshake for current LLM chats.

## Closure evidence

### 2026-09-03 — explicit Sessions implemented

Atlas now persists explicit Session forks with exact selected roots and a durable self-referencing
`forkedFrom` relation. The authenticated bridged fork Operation verifies ownership, open source
state, and source-tree membership before inserting the Session and roots transactionally. Open
Sessions are projected without a total-history cap, while recent closed Sessions remain bounded.

Merged-PR ingestion parses `Atlas-Session` separately from evidence directives. A valid ID routes
one activity to the matching open Session owned by the stable GitHub author identity. Malformed,
duplicate, unknown, closed, and differently owned targets are deliberately unrouted without
implicit fallback; untagged PRs preserve the implicit MVP.

The Sessions workspace switches among simultaneous open and recent Sessions, supports responsive
selection, forks checked Plan branches, shows source lineage, and copies a portable LLM instruction
with a stable URL and exact PR directive. Plan 124's longer-tree dogfood is recorded and that MVP is
closed.

The repository authoring contract now also tells LLM chats and agents to treat that copied
instruction as authoritative input: preserve the exact `Atlas-Session` line through PR creation and
later body edits, never derive an ID from ambient repository context, and omit the directive when no
explicit Session was provided. Atlas owns the canonical guideline; Atlas, Ontahi, and BookOps carry
the same concise rule in their repository-local agent instructions.

Verification passed with 88 default unit/UI tests, 7 PostgreSQL integration tests against an
ephemeral local `postgres:18-alpine` container, typecheck, the production build and lint pass, 78
Atlas-owned source traces, `git diff --check`, and a browser smoke check of the addressable Sessions
workspace with no console warnings or errors.
