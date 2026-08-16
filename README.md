# Workstream Atlas

Workstream Atlas is a standalone, federated viewer for Markdown plans and semantic project models.

This first extraction preserves the existing BookOps Atlas behavior without migrating its domain
layer to Ontahi. Sources are declared once in `atlas.sources.yaml`; canonical references such as
`ontahi://plans/next/128-ontahi-data-graph-execution-bridge` remain portable between repositories.

## Development

```sh
pnpm install
pnpm dev
```

The initial standalone slice can load public repositories from GitHub. A following slice will build
a deterministic local snapshot so normal hosted page requests do not fan out to GitHub.

Sibling checkouts declared with `localRoot` are preferred during local development. Hosted builds
can set `GITHUB_TOKEN` when a configured source is private; the token is used only by the server-side
source loader and is never exposed to the browser bundle.
