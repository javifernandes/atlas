# 138. Ontahí Unified Runtime Bridge

Status: done

Definition level: shaped

## Summary

Remove Atlas-owned Operation transport and Runtime family plumbing. Mount the composed Ontahí
application Runtime Protocol through the Next.js adapter, use the unified Fetch graph client, and
retain Atlas ownership only for trusted identity context and domain authorization.

Related framework work: `ontahi://plans/159-nextjs-application-runtime-mount`.

## Context

Workspace Ownership V0 added membership checks in Next.js route handlers while Atlas still used the
legacy `/operations` endpoint. That secured the immediate slice but put application authorization
above Ontahí and duplicated a Runtime-to-Operation dispatcher that the composed application should
own. Ontahí's unified Fetch client already carries Operations and Graph families through `/runtime`;
the missing lazy Next.js receiver support forced Atlas to keep avoidable plumbing.

## Scope

1. Compose Atlas's `ApplicationRuntimeProtocol` with the application and its policies.
2. Mount that receiver lazily through the Ontahí Next.js Runtime adapter.
3. Configure the browser with `createFetchGraphClient` at `/runtime`.
4. Remove `/operations`, the Atlas dispatcher, and route-level Workspace authorization.
5. Preserve UI/page membership checks until Atlas page reads become policy-scoped Graph Queries.

## Non-goals

1. Do not implement Workspace invitations or mutations in this slice.
2. Do not pretend the current server-rendered projection is a browser Graph Query.
3. Do not add permissive Graph policies merely to exercise the unified endpoint.
4. Do not move host authentication into Ontahí.

## Proposed form

```text
Atlas browser -> Ontahí Fetch Graph Client -> /runtime
  -> Next.js Runtime adapter -> lazy Atlas application receiver
  -> Operation / Graph policy boundary
```

The route derives only the trusted Principal. Operations enforce authentication and ownership
inside the application. Graph Reads remain unavailable until Atlas declares explicit policies.

## Execution slices

1. [x] Adopt the lazy Ontahí application receiver.
2. [x] Replace the legacy Operation adapter with the unified Fetch graph client.
3. [x] Delete `/operations` and Atlas's custom family dispatcher.
4. [x] Update tests and durable identity/runtime guidance.
5. [x] Verify Atlas against packed and then published Ontahí packages.

## Verification

1. Invalid Runtime envelopes are rejected before application or identity initialization.
2. Bridge-exposed Session Operations still receive the authenticated Atlas Principal.
3. Server-only Operations remain unreachable through `/runtime`.
4. Atlas contains no `/operations` endpoint or custom Operation dispatcher.
5. `pnpm verify` and PostgreSQL integration tests pass against the exact released Ontahí version.

## Closure / Evolution

Checkpoint (2026-10-26): the packed-artifact consumer proof passes the Runtime route, application,
and typecheck checks. Full verification is deferred to the coherent published package set;
installing only changed tarballs beside exact-version Ontahí packages creates duplicate Core module
identity and is not representative of the release graph.

Closed (2026-10-28): Atlas consumes the coherent `@ontahi/*@1.0.0-alpha.16` release, `pnpm verify`
passes, and all 11 PostgreSQL integration tests pass. The production build exposes `/runtime` and no
`/operations` route. Workspace settings and membership administration should next use policy-scoped
Graph Queries and Operations over this common Runtime boundary.
