---
id: spec-workstream-atlas.operating-practice.production-schema-migration
kind: practice
title: Production Schema Migration
parent: spec-workstream-atlas.operating-practice
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.access-identity.persistent-user
  - spec-workstream-atlas.atlas-model.reconciliation
relatedPlans:
  - plans/current/123-persistent-users-and-linked-accounts-v0.md
  - plans/current/116-atlas-ontahi-postgres-persistence.md
---

Production Schema Migration makes every committed Atlas migration converge automatically after a
change enters `main`. A GitHub Actions job scoped to the `Production` environment uses only the
direct `DATABASE_URL_UNPOOLED` secret, applies every missing checksum migration, and then verifies
the Ontahí and Better Auth physical schemas. It never runs with production credentials for Pull
Request events.

Production migrations are serialized and an active run is never cancelled. Atlas's migration
runner adds a PostgreSQL advisory lock, immutable applied-file checksums, and one transaction per
migration, so retries and overlapping Vercel/GitHub invocations converge safely.

Vercel production builds run the same migrate-and-verify gate before compiling the deployment.
Preview and local builds do not touch production. This closes the timing gap between GitHub's
post-merge workflow and Vercel's automatic deployment: a production build cannot publish code for
a schema it failed to install or verify.

Schema evolution remains expand-first. A migration must be compatible with the currently running
application, and destructive contract steps require a later deployment after all readers have
moved away from the old shape. Manual dispatch and `pnpm db:migrate` remain recovery paths rather
than normal release steps.
