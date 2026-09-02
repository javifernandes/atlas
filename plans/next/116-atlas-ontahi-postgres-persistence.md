# 116. Atlas Ontahi PostgreSQL Persistence

Status: next

Depends on: [111. Atlas As An Ontahi Application](../done/111-atlas-as-ontahi-application.md)

Unblocks:
[102. Atlas Implementation And Release Evidence](../current/102-workstream-atlas-implementation-evidence.md)

## Summary

Move Atlas from a request-assembled, in-memory Ontahi application to a durable Ontahi application
backed by PostgreSQL on Neon. Markdown, GitHub, repository history, package registries, and release
providers remain the authorities for their records; PostgreSQL materializes the normalized Atlas
graph, observed evidence, reconciliation state, and Atlas-owned provenance needed for stable reads
and historical navigation.

This persistence foundation lands before Changeset and release ingestion. Those records disappear
or aggregate over time, so implementing their navigation on top of another ephemeral projection
would create avoidable rework.

## Context

Atlas currently builds normalized source records, fetches Pull Request evidence, and hydrates an
Ontahi dataset when a server process loads the application. A module-local application cache and
Next.js cache invalidation make the deployed UI usable, but they do not provide:

1. durable evidence across serverless instances and deployments;
2. transactional webhook ingestion or delivery-id deduplication;
3. a retained correlation between a Changeset before release and the version that later consumes
   it;
4. an explicit projection revision that can be rebuilt and audited;
5. a storage-backed Ontahi runtime shared by page reads, Runtime Protocol operations, and ingress.

Plan 111 established Ontahi as the application and operation boundary. Plan 102 proved signed
GitHub ingress and explicit PR evidence without requiring a database. The next evidence slice now
earns persistence: Changesets and releases need a stable, queryable history rather than repeated
reconstruction during page rendering.

A Neon PostgreSQL project is available for the production branch. The repository should consume it
through Ontahi's PostgreSQL persistence boundary rather than building Atlas-specific SQL access
throughout loaders and routes.

## Research / Evidence

1. `createAtlasOntahiApplication` currently receives a complete in-memory dataset assembled from
   normalized Markdown and observed Pull Requests.
2. `loadAtlasServerApplication` performs source and GitHub reads before constructing that
   application.
3. The GitHub webhook operation currently invalidates repository cache tags; it does not commit an
   evidence record or remember the delivery.
4. Ontahi already exposes a PostgreSQL package and application/runtime abstractions intended to
   keep persistence behind the domain boundary.
5. Changesets are temporary repository records: release/version operations consume their source
   files while preserving their meaning in versions and changelogs.
6. The target Neon project is `weathered-rain-59323266`, using branch `production`. Connection
   credentials and generated environment values remain secret and must not be committed.

## Scope

1. Initialize the repository's Neon configuration and document local, preview, and production
   environment ownership.
2. Validate the exact Ontahi PostgreSQL adapter and version required by Atlas before adding direct
   database dependencies.
3. Introduce an Atlas storage composition boundary used by page reads, Runtime Protocol handlers,
   reconciliation operations, and webhook ingress.
4. Materialize normalized Plans, Atlas Items, their relations, source provenance, Pull Requests,
   Evidence Bindings, and projection revisions in PostgreSQL.
5. Add deterministic upsert identities and transactional reconciliation so repeated source syncs
   or webhook deliveries converge on one graph.
6. Persist webhook delivery identity and the observed records needed for historical evidence while
   retaining GitHub as PR authority.
7. Backfill the database from the existing federated Markdown and GitHub adapters.
8. Cut production reads over to the persisted Ontahi application with an explicit rebuild and
   recovery operation.
9. Provide tests and operational checks for migrations, empty-database bootstrap, idempotency,
   deploys, and source reconciliation.

## Non-Goals

1. Do not move curated Plan or Atlas Item authoring out of Markdown.
2. Do not make PostgreSQL authoritative for GitHub Pull Requests, package versions, or external
   release metadata.
3. Do not implement Changeset parsing, package registry observation, or release UI in this plan.
4. Do not persist raw webhook secrets, installation private keys, or unbounded payload mirrors.
5. Do not expose a generic database client to viewer components or transport routes.
6. Do not remove source provenance merely because the normalized projection is persisted.
7. Do not make production depend on a developer's Neon CLI login or locally generated credentials.

## Proposed Form

### Authority and projection boundary

```txt
Markdown / GitHub / repository history / registries
                    |
                    v
        source-specific observed records
                    |
                    v
       Atlas reconciliation operations
                    |
                    v
      Ontahi application + PostgreSQL runtime
                    |
          +---------+----------+
          |                    |
          v                    v
    page/read model      Runtime Protocol / ingress
```

PostgreSQL is the durable materialized application state. Every stored external record retains its
source identity and revision so Atlas can refresh, reconcile, or remove it without pretending to
own the upstream fact.

### Initial persisted identities

The exact physical schema is an implementation output, but the logical identities must be stable:

| Record | Idempotent identity |
| --- | --- |
| Semantic source revision | source id + repository revision |
| Plan or Atlas Item | canonical semantic id |
| Declared relation | source id + relation identity |
| Pull Request | repository + PR number |
| Evidence Binding | evidence id + target id + assertion kind |
| Webhook delivery | GitHub delivery id |
| Projection revision | reconciliation run id + source revision set |

Changeset, Component Version, and Release identities are added by Plan 102 after this boundary is
proven.

### Neon repository setup

The implementation chat starts with the supplied Neon workflow:

```sh
npm i -g neon@latest
neon login
neon skills -y
neon mcp -y
neon link --project-id weathered-rain-59323266 --branch production -y
neon config init
```

The committed configuration should expose no credentials and begin with:

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({});
```

Run `neon deploy` only after reviewing the generated migration/configuration diff and confirming
that local verification targets the intended Neon branch.

### Runtime cutover

The target application lifecycle is:

```txt
deploy/migration
  -> reconcile registered sources into PostgreSQL
  -> serve reads from the persisted Ontahi application

GitHub delivery
  -> verify and normalize
  -> deduplicate by delivery id
  -> upsert observed PR/evidence through an Ontahi operation
  -> commit atomically
  -> invalidate only the derived presentation cache
```

The existing assembly path remains useful as a rebuild input and temporary rollout fallback, not as
the permanent production read path.

## Execution Slices

### Slice 0: Provider and adapter setup

1. Run the Neon CLI initialization flow in an isolated implementation branch.
2. Inspect generated files before committing them and keep credentials in local/Vercel environment
   configuration.
3. Verify Ontahi's PostgreSQL adapter against the Atlas application model with one local smoke
   entity and relation.
4. Record any missing Ontahi capability as focused upstream feedback rather than bypassing the
   application boundary with scattered SQL.

### Slice 1: Storage composition and migrations

1. Define the server-only Atlas storage composition root.
2. Add deterministic schema/migrations for the initial persisted identities.
3. Exercise an empty-database bootstrap and repeated migration.
4. Keep an in-memory composition available for focused unit tests.

### Slice 2: Source reconciliation and backfill

1. Reuse normalized source adapters as reconciliation inputs.
2. Upsert the current semantic graph and source provenance transactionally.
3. Reconcile removals and moves without erasing unrelated source authority.
4. Backfill current merged-PR evidence and verify convergence on a repeated run.

### Slice 3: Read and Runtime Protocol cutover

1. Serve page projections and application-bound graph reads from PostgreSQL.
2. Make Runtime Protocol operations use the same persisted application composition.
3. Remove request-time GitHub/source reconstruction from the normal read path.
4. Retain an explicit rebuild/reconcile operation for recovery.

### Slice 4: Durable ingress and rollout

1. Persist normalized webhook effects and delivery ids atomically.
2. Verify duplicate delivery behavior and partial-failure recovery.
3. Configure production environment values in Vercel without committing secrets.
4. Deploy migrations, backfill, cut reads over, and verify Atlas-owned plus federated sources in
   production.
5. Document rollback and rebuild procedures before removing the ephemeral fallback.

## Verification

- [ ] A clean environment can initialize and migrate the Neon branch without manual SQL.
- [ ] Atlas can bootstrap an empty database from registered Markdown sources and GitHub evidence.
- [ ] Repeating the same reconciliation produces no duplicate Items, relations, PRs, or bindings.
- [ ] Duplicate GitHub deliveries are durably deduplicated across server instances.
- [ ] Page reads and Runtime Protocol operations observe the same persisted graph.
- [ ] Atlas-owned and federated sources remain identifiable by canonical provenance.
- [ ] Removing or moving a source record reconciles only data owned by that source revision.
- [ ] No Neon credentials, GitHub secrets, or private keys appear in committed files or logs.
- [ ] Local tests cover the in-memory composition while integration tests prove PostgreSQL behavior.
- [ ] Production deploy, backfill, rebuild, and rollback paths are documented and exercised.
- [ ] Plan 102 can add Changesets without introducing another storage architecture.

## Decisions

1. Persistence precedes Changeset and release ingestion.
2. Neon PostgreSQL is the first durable production store.
3. Atlas consumes PostgreSQL through Ontahi's application/persistence boundary.
4. Markdown and external providers remain semantic authorities; PostgreSQL is the operational
   projection and Atlas-owned provenance store.
5. Reconciliation is idempotent and source-aware rather than append-only mirroring.
6. Page reads, Runtime Protocol operations, and webhook ingress share one storage composition.
7. Database-backed behavior receives integration coverage; pure domain behavior may continue using
   the in-memory composition.
8. Provider setup and generated Neon files are reviewed before `neon deploy` mutates the linked
   branch.

## Open Questions

1. Does the currently published Ontahi PostgreSQL package support the full Atlas relation and query
   topology, or does Atlas first need an Ontahi release?
2. Which projection revisions should be retained after a successful reconciliation?
3. Should source reconciliation run on deploy, webhook invalidation, a scheduled worker, or a
   combination with an explicit operation?
4. What is the safest production migration order while the current serverless projection remains
   live?
5. Should preview deployments receive isolated Neon branches automatically, or use an explicit
   shared non-production branch initially?

## Closure / Evolution

Created after merged-PR evidence proved the first observed Atlas record and before beginning
Changeset ingestion. The decision replaces Plan 102's earlier persistence deferral: stable release
history now justifies a durable Ontahi application, while Markdown and provider ownership remain
unchanged.
