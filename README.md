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

Set `ATLAS_GITHUB_TOKEN` when a hosted build needs read access to private sources. This token is
used only by the server-side source loader and is not exposed to the browser bundle.

## Hosted source refreshes

Hosted instances materialize their configured sources during deployment. The included
`Refresh sources` GitHub Actions workflow triggers a rebuild manually or every six hours so source
updates become visible without changing this repository.

For a Vercel deployment, create a Deploy Hook for the production branch and store its URL as the
`VERCEL_DEPLOY_HOOK_URL` GitHub Actions repository secret. Treat the hook URL as a credential: anyone
who has it can trigger a deployment.

## Development

```sh
pnpm install
pnpm dev
```

The current implementation loads sources while rendering. The next extraction slice will produce a
deterministic build-time snapshot so normal hosted page requests never fan out to source providers.
