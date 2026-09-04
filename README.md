# Atlas

Atlas is a federated viewer for Markdown plans and semantic project models. A workspace may combine
one or many repositories while each document remains owned by its source repository.

Sources are named once in configuration. Documents can then use portable references such as
`platform://plans/12-runtime-bridge` without repeating repository URLs.

Atlas is also its own intrinsic source. Repository-local files under `plans/` and `atlas/items/`
are always loaded with the source id `atlas`; they do not need to register this repository as an
external dependency. The `atlas` id is therefore reserved and must not appear in source
configuration.

## Source configuration

Copy `atlas.sources.example.yaml` to the ignored `atlas.sources.local.yaml` and point each source at
a repository and, optionally, a sibling checkout:

```yaml
version: 1
sources:
  product:
    repository: https://github.com/acme/product
    localRoot: ../product
    ref: main
  platform:
    repository: https://github.com/acme/platform
    localRoot: ../platform
    ref: main
```

Configured local checkouts are preferred when they contain `plans/` or `atlas/items/`. Otherwise
Atlas reads the configured GitHub repository. Deployments may provide the same YAML through
`ATLAS_SOURCES_YAML`, keeping workspace-specific repositories out of the application repository.

Hosted environments should use the Atlas GitHub App for private source access and merged-PR
evidence. The App mints short-lived installation tokens and receives signed events through Ontahi
HTTP ingress. See [Atlas GitHub App](docs/github-app.md). `ATLAS_GITHUB_TOKEN` remains an optional
local read fallback and is never exposed to the browser bundle.

Human authentication is a separate boundary. Atlas supports stateless GitHub login through Better
Auth and can gate the deployment viewer as public or private without using the human OAuth token for
repository reads. See [Atlas Authentication](docs/authentication.md).

## Sessions

Sessions are personal execution views over the shared Plan tree. Untagged attributable merges keep
the default implicit Session behavior. A User can select Plan branches from an open Session and fork
them into separately named explicit Sessions without moving source history or copying prior PR
activity.

Open or closed Sessions can be archived without deleting their Plans or PR history. Archived
Sessions stay hidden by default, can be revealed and restored, and remain addressable by their
stable URL. Newly routed activity automatically resurfaces an archived open Session. The session
rail shows the latest merged-PR activity time for every interval, including open Sessions.

Each open Session has a stable URL and a **Copy for LLM** action. Future PRs from that chat route to
the Session by retaining this line in the PR body:

```text
Atlas-Session: <session-uuid>
```

This directive routes activity only; PRs still use `Atlas-Implements` and `Atlas-Shapes` for
semantic evidence. Invalid explicit Session routing never falls back automatically. See
[Atlas Evidence Binding Guidelines](docs/atlas-evidence-binding-guidelines.md#session-routing).

## Hosted source refreshes

Signed GitHub App `push` and merged-pull-request webhooks now reconcile registered authorities into
PostgreSQL transactionally. Normal page reads consume one durable Projection Revision and never fan
out to source providers. Duplicate delivery ids converge across server instances.

For a Vercel deployment, create a Deploy Hook for the production branch and store its URL as the
`VERCEL_DEPLOY_HOOK_URL` GitHub Actions repository secret. Treat the hook URL as a credential: anyone
who has it can trigger a deployment. The scheduled workflow remains a redeploy fallback during the
database rollout; explicit projection recovery uses `pnpm db:rebuild`.

See [PostgreSQL persistence](docs/postgres-persistence.md) for migrations, reconciliation, Neon
branch testing, cutover, and rollback.

## Development

```sh
pnpm install
pnpm dev
pnpm test:postgres
```

Local development defaults to the focused in-memory Ontahi runtime. Set the documented PostgreSQL
environment values and storage mode only when exercising the durable composition. Use
`pnpm test:postgres:neon` for an isolated compatibility proof against an expiring Neon branch.
