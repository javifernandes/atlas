# 130. GitHub Merge Catch-Up

Status: done

## Summary

Add an explicit, idempotent recovery path for merged Pull Requests whose GitHub webhooks could not
be processed during an Atlas or database outage. The operation re-observes GitHub authority,
converges normal Pull Request evidence, and appends only missing Session activity.

## Context

Atlas correctly treats GitHub as the authority for merged Pull Requests, and every webhook performs
a full evidence observation before committing a Projection Revision. That makes Pull Request and
Evidence Binding records recoverable through `db:reconcile` or a later successful webhook.

Session activity has a narrower contract: it is appended only for the Pull Request carried by the
current webhook. During the September 2026 Neon transfer outage, failed deliveries could therefore
leave Session history incomplete even after evidence converged again. GitHub retains deliveries for
manual redelivery for only three days and does not automatically retry failed webhooks, so replay is
not a complete recovery strategy.

The existing GitHub observer reads a bounded recent window of closed Pull Requests and stable IDs
them as `github:<repository>#<number>`. PostgreSQL already uniquely constrains one Session activity
per Pull Request. The durable set difference is a safer recovery checkpoint than a single timestamp:
it tolerates delayed deliveries, out-of-order merges, and prior evidence-only reconciliation.

## Scope

1. Add an explicit `catch-up` reconciliation trigger.
2. Preserve enough normalized Pull Request input to re-evaluate Session routing.
3. Preview missing attributable activity without writing.
4. Apply missing activity oldest-first inside the same serialized projection transaction.
5. Keep live webhook deduplication and delivery records unchanged; catch-up does not fabricate
   GitHub delivery IDs.
6. Add a manually dispatched production workflow with dry-run as the default.
7. Commit the Atlas source registry so operator reconciliation observes Atlas, BookOps, and
   Ontahí consistently outside Vercel.

## Non-Goals

1. Do not synthesize or backfill `WebhookDelivery` records.
2. Do not poll GitHub during ordinary page reads.
3. Do not automatically schedule catch-up until the manual recovery path is exercised.
4. Do not force historical activity into a closed or invalid explicitly addressed Session.
5. Do not infer activity from PRs without resolved Plan evidence or a linked Atlas User.

## Proposed Form

```text
pnpm db:catch-up -- --since=<ISO-8601>
  -> observe current sources and bounded GitHub PR history
  -> exclude Pull Requests before the operator-reviewed recovery window
  -> compare directive-bearing Pull Requests with durable Session activity
  -> print exact candidates and skip reasons
  -> no writes

pnpm db:catch-up -- --since=<same-ISO-8601> --apply
  -> run the same authority observation
  -> reconcile the current durable projection once
  -> append missing attributable activity oldest-first
  -> preserve stable PR/activity identities and current recency
```

The manual GitHub Actions workflow uses the Production database secret, authenticates GitHub reads
with its scoped workflow token, and defaults to dry-run. A successful apply may be repeated without
duplicating evidence, activities, or Sessions.

## Execution Slices

1. [x] Extend the normalized PR observation and reconciliation contract for catch-up.
2. [x] Add a read-only catch-up preview with candidate and skip diagnostics.
3. [x] Reuse the existing Session attribution path to apply missing activity idempotently.
4. [x] Add the operator script, source registry, and manual Production workflow.
5. [x] Cover evidence parsing, preview, activity recovery, rerun idempotency, and out-of-order
       recency behavior.
6. [x] Run `pnpm verify` and the PostgreSQL integration suite, then record closure.

## Verification

1. Dry-run performs no writes and reports exact PR identities.
2. Apply restores one missing activity for an attributable merged PR.
3. Repeating apply creates no additional activity or Session.
4. Missing users, unresolved Plans, and invalid or closed explicit Sessions remain visible as
   skipped rather than silently rerouted.
5. Backfilled older activity does not regress Session focus, archive state, or recency.
6. Webhook delivery deduplication remains unchanged.
7. `pnpm verify`, PostgreSQL integration tests, workflow lint, and `git diff --check` pass.

## Decisions

1. Use stable set reconciliation within an explicit operator-reviewed lower bound rather than a
   timestamp-only cursor or an unbounded historical backfill.
2. Keep the GitHub observer bounded and explicit instead of adding provider calls to page reads.
3. Make dry-run the command and workflow default; applying recovery requires an explicit flag.
4. Reuse normal evidence reconciliation once per apply rather than once per missed PR.
5. Keep recovery distinct from webhook delivery provenance.

## Open Questions

1. After production exercise, should a daily dry-run or apply become the long-term backstop?
2. Should a later incremental observer replace the current bounded 500-PR window for much larger
   repositories?

## Closure / Evolution

Completed with a dry-run-first operator command, an explicitly applied Production workflow, a
committed source registry, and one serialized `catch-up` reconciliation mode. The
PostgreSQL integration proof covers no-write preview, missing activity recovery, rerun
idempotency, and historical activity that preserves newer Session focus, recency, and archive
state.

Closure verification:

- `pnpm verify`
- `pnpm test:postgres`
- `actionlint .github/workflows/catch-up-production.yml`
- `git diff --check`

Follow-ups remain intentionally separate: exercise the workflow against Production after deploy,
then decide whether a scheduled backstop or an observer beyond the current bounded 500-PR window
is warranted.

The first Production preview exposed a credential-boundary correction: `github.token` is scoped
to Atlas and cannot observe private federated sources. The workflow now requires the Atlas GitHub
App ID and a private key in the GitHub `Production` environment, matching the installation-token
path used by the hosted application.

The first complete preview also exposed an unsafe scope assumption: the bounded GitHub observer
still reached directive-bearing work from before Sessions existed. Catch-up now requires one
ISO-8601 lower bound, reports excluded history, records the bound in Projection Revision
diagnostics, and applies only the reviewed window. Stable identities remain the missing-activity
checkpoint inside that window.

The first bounded workflow invocation exposed that pnpm preserves its conventional standalone
`--` argument separator for this script. The catch-up CLI now accepts that delimiter explicitly,
with a focused parser test covering the exact Production invocation shape.
