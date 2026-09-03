# Atlas PostgreSQL persistence

Atlas uses PostgreSQL on Neon as its durable operational projection. Markdown, GitHub, Git history,
package registries, and release providers remain authoritative. The database stores normalized
records, source revisions, provenance, reconciliation history, and the read snapshot shared by all
server instances.

## Composition boundary

`src/atlas/server/atlas-composition.ts` is the server composition root. Page reads, Runtime
Protocol operations, and signed GitHub ingress resolve the same Ontahi application from it. Normal
page reads load one committed `ProjectionRevision` snapshot; they do not read repositories, call
GitHub, or construct an in-memory graph.

Source adapters remain reconciliation inputs. The hosted PostgreSQL composition observes Atlas and
external repositories at fixed Git tree SHAs, so a push delivery never re-reads an older deployment
filesystem or records branch-moving content against the wrong revision. The memory rollback uses
the packaged deployment corpus. A manual rebuild, a merged Pull Request webhook, or a repository
push webhook commits one transaction containing:

1. current source revisions and normalized source records;
2. Items, Plans, and their declared relations;
3. authoritative Pull Request observations and explicit Evidence Bindings;
4. the source-revision set and diagnostics for the new Projection Revision;
5. the durable GitHub delivery id and its resulting projection revision.

Reconciliation upserts the current inventory and deletes only absent identities. If one GitHub
evidence source is temporarily unavailable, its previous bindings remain intact and the new
revision is marked `degraded`. A PostgreSQL row lock serializes reconcilers, and an observation
older than the latest committed revision cannot overwrite it.

## Environment ownership

| Environment | Database policy | Configuration |
| --- | --- | --- |
| Unit tests and default local development | In-memory Ontahi runtime | No database values required |
| Local PostgreSQL integration | Ephemeral `postgres:18-alpine` Testcontainer | `pnpm test:postgres` |
| Neon compatibility test | Expiring child branch of `production` | `pnpm test:postgres:neon`; Neon CLI login only |
| Preview | Isolated Neon preview branch | Preview-scoped `DATABASE_URL` and `DATABASE_URL_UNPOOLED` |
| Production | Neon project `weathered-rain-59323266`, branch `production` | Vercel environment values; no CLI login at runtime |

Production defaults to `ATLAS_STORAGE_MODE=postgres`. `DATABASE_URL` is the pooled application
connection. `DATABASE_URL_UNPOOLED` is preferred by migrations and operator reconciliation. Keep
both values in local ignored files or environment-secret stores; never put them in Git, logs, PR
bodies, or shell tracing.

`ATLAS_STORAGE_MODE=memory` is the explicit application rollback. It reconstructs one in-memory
Ontahi application per server instance from the authoritative sources and resets that composition
after a source webhook. It is not the normal production read path.

Atlas-owned Markdown remains in the page, Runtime Protocol, and ingress deployment traces solely
so this rollback and explicit reconciliation path can operate in a serverless deployment. The
normal PostgreSQL page path is covered to perform one Projection Revision read and never invokes a
source adapter.

## Migrations and bootstrap

The migration runner records immutable file checksums in `atlas_migrations`, takes a PostgreSQL
advisory lock, and applies each new migration transactionally.

```sh
pnpm db:migrate
pnpm db:verify
pnpm db:reconcile
```

`db:reconcile` performs a normal manual reconciliation. `pnpm db:rebuild` uses the explicit
`rebuild` trigger and is the recovery command when the projection must be reconstructed from its
authorities. Both commands print identities and counts only, never connection strings.

`db:verify` checks both the Ontahí-backed Atlas projection schema and Better Auth's persistent
User/Account/Session/Verification schema. A pending Better Auth table, field, index, or unsafe
change fails the command.

For a clean environment, apply migrations before the first reconcile. An empty database is a valid
pre-bootstrap state: the page returns an empty Atlas view until the first Projection Revision is
committed.

## Neon changes and validation

Before applying Neon configuration, confirm the linked project and branch:

```sh
neon status
neon config plan
neon deploy
```

`neon deploy` manages the reviewed `neon.ts` policy; Atlas schema evolution remains owned by the
checksum migrations. The compatibility test creates a named child branch with a one-hour expiry,
captures its connection string without printing it, runs the same integration suite, and deletes
the branch in cleanup.

## Rollout

Use this order for production:

1. verify the linked Neon project and branch;
2. apply migrations through the unpooled connection;
3. run `pnpm db:reconcile` and inspect the safe counts;
4. configure Vercel with both database URLs, `ATLAS_STORAGE_MODE=postgres`, the source registry,
   and GitHub App credentials;
5. deploy the application;
6. verify the page, one Runtime Protocol read/operation, a signed `push` delivery, and a signed
   merged-PR delivery against the same revision;
7. run `pnpm db:rebuild` once as the recovery rehearsal and confirm the graph converges.

The GitHub App must subscribe to both **Push** and **Pull request** events for every registered
repository. Pull Request and push deliveries have independent GitHub delivery ids, so receiving
both is safe; each delivery converges through the same serialized reconciliation transaction.

## Rollback

Application rollback does not roll back or delete the database:

1. set `ATLAS_STORAGE_MODE=memory` in the affected deployment environment;
2. redeploy the same application commit;
3. verify that page and Runtime Protocol reads reconstruct from Markdown and GitHub;
4. diagnose or restore PostgreSQL while preserving migrations, Projection Revisions, delivery ids,
   and evidence history;
5. run `pnpm db:verify` and `pnpm db:rebuild`, then switch the environment back to `postgres` and
   redeploy.

Never downgrade by editing or deleting an applied migration. Correct forward with a new migration;
the retained projection history remains available for diagnosis.
