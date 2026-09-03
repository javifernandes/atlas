---
id: spec-workstream-atlas.implementation-evidence
kind: evidence
title: Implementation Evidence
parent: spec-workstream-atlas
status: shaping
horizon: now
supports:
  - spec-workstream-atlas
  - bookops
relatedPlans:
  - plans/current/102-workstream-atlas-implementation-evidence.md
  - plans/done/116-atlas-ontahi-postgres-persistence.md
  - plans/done/111-atlas-as-ontahi-application.md
  - bookops://plans/18d-web-phase-2plusplus-storybook-information-architecture
  - bookops://plans/23-feedback-ui-hardening-and-storybook
---

Implementation Evidence binds atlas items to the code, tests, Storybook surfaces, and preview environments that make a workstream inspectable after it moves into review or QA.

The goal is not to turn the atlas into CI. The goal is to let a semantic item answer practical review questions: what implementation changed, how much of it is covered, which stories demonstrate it, and where can someone try it?

Durable [[spec-workstream-atlas.atlas-model.implementation-component|Implementation Components]]
and [[spec-workstream-atlas.atlas-model.implementation-surface|Implementation Surfaces]] are curated
in Markdown. PRs, commits, Changesets, package versions, releases, deployments, and coverage remain
observed evidence owned by their source systems. Atlas relates and, when useful, caches that data;
it does not mirror every event into Markdown.

The persistent projection uses Ontahi with PostgreSQL on Neon. It retains normalized
evidence, source provenance, reconciliation state, and Atlas-owned inference while Markdown,
GitHub, repository history, registries, and release providers remain authoritative. Persistence is
the foundation for Changeset ingestion because a release may consume the source file whose meaning
Atlas must continue to navigate. Temporary GitHub failures produce a degraded Projection Revision
without deleting the last durable bindings for the unavailable source.

Atlas, Ontahi, and BookOps Pull Requests bind their implementation intent to stable Plan or Item
identities with `Atlas-Implements` and `Atlas-Shapes`. Atlas observes those author assertions from
the merged PR body and preserves GitHub as the authority for the evidence record.

Repository validation follows the changed source boundary. Markdown-only Atlas changes run the
focused semantic-source and snapshot tests plus diff checks; executable application, workflow,
configuration, and dependency changes retain the complete test, typecheck, and build pipeline.

## Child Items

1. [`Coverage And Code Impact`](./implementation-evidence/coverage-and-code-impact.md)
2. [`Storybook Bindings`](./implementation-evidence/storybook-bindings.md)
3. [`Preview Environments`](./implementation-evidence/preview-environments.md)
