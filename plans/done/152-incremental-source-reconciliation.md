# 152. Incremental source reconciliation

Status: done

## Summary

Reduce webhook reconciliation CPU and network work by observing only the registered Markdown
source whose repository changed, while rebuilding the global projection from that fresh source and
the persisted records and lineage of unchanged sources.

## Context

Plans 150 and 151 removed irrelevant pushes, duplicate deliveries, and the second half of the
common push/merged-PR pair. The first signal for a new commit still downloads and parses every
configured source. That cost grows with the federation even though a signed GitHub webhook names
the repository whose default-branch revision changed.

The current global graph publication remains intentionally atomic. The next useful containment
step is therefore incremental observation, not partial graph mutation: reuse durable source
records as the input snapshot for unchanged authorities, replace one source observation, then run
the existing parser, identity checks, and publication transaction over the complete logical set.

## Research / Evidence

- `atlas_source_records` retains normalized Markdown content and physical source identity.
- `atlas_source_revisions` plus projection lineage retains the repository and revision accepted for
  each source.
- GitHub webhook requests carry a normalized repository name and exact default-branch revision.
- Manual, build, and catch-up reconciliation do not identify one changed source and must continue
  to observe the complete configured set.

## Scope

- Load a persisted source baseline before a non-coalesced webhook reconciliation.
- Match the webhook repository to exactly one registered Markdown source.
- Observe only that source, replace its baseline records and revision, and retain every unchanged
  source from the baseline.
- Fall back to full source observation when the baseline is missing/incomplete or the repository
  is not a registered Markdown source.
- Keep Pull Request evidence observation and global graph publication behavior unchanged.

## Non-Goals

- Incremental parsing or partial PostgreSQL graph writes.
- Incremental GitHub Pull Request evidence loading.
- Replacing immutable Projection Revisions with mutable per-source state.
- Changing Workspace Source reconciliation, which has its own partitioned execution model.

## Proposed Form

Webhook reconciliation has two observation modes:

1. **source-incremental**: a complete persisted baseline exists and the webhook repository maps to
   one configured source; Atlas reloads that source and composes a complete logical input.
2. **full**: bootstrap, manual/build/catch-up work, unknown repositories, or incomplete lineage;
   Atlas observes every source as today.

Both modes pass the same complete projection input to the existing deterministic dataset builder
and atomic publication transaction. A source deletion is represented by removing all baseline
records for the changed source before adding its newly observed records.

## Execution Slices

- [x] Expose targeted Markdown source observation and safe baseline composition.
- [x] Load the latest persisted source baseline before eligible webhook observation.
- [x] Preserve full observation fallbacks and evidence behavior.
- [x] Cover changed-source replacement, deletion, unchanged-source reuse, and fallback behavior.
- [x] Update the durable Reconciliation operation with the accepted boundary.

## Verification

- Focused source/projection unit tests pass.
- PostgreSQL integration tests prove a webhook receives a complete persisted baseline and still
  publishes correct source lineage.
- `pnpm verify` passes.
- `git diff --check` passes.

## Decisions

- The first incremental slice optimizes source observation only. It deliberately pays the existing
  parsing and publication cost so correctness stays behind one complete-set transaction.
- The persisted baseline is an optimization input, never an authority override. Any ambiguity or
  missing source revision selects full observation.

## Open Questions

- Whether a later slice should incrementally observe Pull Request evidence for the changed
  repository.
- Whether graph derivation and writes are large enough after this change to justify per-source
  parsed artifacts or dependency-aware partial publication.

## Closure / Evolution

Atlas now reads the current persisted source records and revisions before eligible webhook work.
When that baseline exactly covers the configured registry and the webhook repository maps to one
source, only that source is observed; its prior records are removed from the logical input and its
fresh records and lineage are composed with every unchanged source. Unknown repositories,
incomplete baselines, and non-webhook triggers retain the full loader.

The incremental input also carries the exact Projection Revision from which its baseline was read.
Publication fails without mutation if another reconciliation advances that revision first, so
concurrent source webhooks cannot restore stale records. The provider may safely retry the delivery.

Pull Request evidence loading, Markdown parsing of the complete composed input, dataset derivation,
and atomic PostgreSQL publication remain intentionally global. Those are measurable follow-ups,
not requirements for this first containment slice.
