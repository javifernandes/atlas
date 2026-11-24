# 163. Incremental GitHub evidence replication

Status: current

## Summary

Represent GitHub Pull Request evidence as an explicit replicated Source instead of rescanning the
complete closed-PR collection during every Atlas reconciliation. Persist a per-repository
observation frontier and the normalized PR records that can contribute evidence, then observe only
PRs whose GitHub `updated_at` advanced beyond the accepted frontier.

## Context

Production observation after incremental Markdown parsing showed that parsing three changed
records took roughly 116 ms while loading 250 Pull Requests took roughly 9.2 seconds. GitHub owns
the PR collection and Atlas already derives `PullRequest` and `EvidenceBinding` entities from it,
but the loader currently reconstructs that input collection from up to twenty API pages on every
webhook.

Merged commits and diffs are stable, while PR title, body, labels, actors, and other metadata may be
edited after merge. Atlas therefore cannot treat a closed PR as permanently immutable. GitHub's
`updated_at` ordering provides the observation frontier: unchanged older pages can be reused, while
edited historical PRs naturally re-enter the incremental window.

## Scope

- Persist one accepted GitHub PR observation frontier per registered repository.
- Persist normalized merged PR evidence records independently from the final Atlas projection.
- Fetch updated pages until the accepted frontier is crossed, with an inclusive overlap for equal
  timestamps.
- Apply additions, edits, and removal of Atlas directives idempotently.
- Reuse the complete accepted replica when GitHub has no newer observations.
- Preserve full observation as bootstrap and repair behavior.
- Observe fetched, reused, and materialized counts separately from projection assembly.

## Non-Goals

- Incremental semantic graph assembly or partial Projection Revision publication.
- Treating PostgreSQL as authority for GitHub metadata.
- Generalizing a declarative replicated-collection API in Ontahi before this behavior is proven.
- Replicating comments, reviews, labels, or open PRs in the first slice.

## Proposed Form

```txt
GitHub repository Pull Requests@updated_at
  -> observed page changes
  -> repository evidence frontier + normalized relevant PR records
  -> PullRequest + EvidenceBinding projection
```

The replica stores enough normalized provider state to reproduce the evidence input, but it remains
reconstructible from GitHub. The frontier is the greatest accepted provider `updated_at`; fetching
is inclusive at the boundary so timestamp ties cannot hide a change. Records observed without any
supported Atlas directive remove an older relevant record with the same repository/number.

This is a second Atlas case of the replicated-versioned-model pattern. Unlike the Git Markdown
Source, its revision is a provider collection frontier rather than a Git commit, and its ChangeSet
is discovered from an ordered updated window rather than supplied as file operations.

## Execution Slices

1. [x] Add the durable repository frontier and normalized evidence-record replica.
2. [x] Make PR observation bootstrap fully, then fetch only through the accepted frontier.
3. [x] Compose cached records with observed changes and persist the next frontier idempotently.
4. [x] Add stage metrics for fetched, reused, changed, and resulting evidence records.
5. [x] Prove edits adding or removing directives and timestamp ties converge correctly.
6. [ ] Evaluate the behavior as a candidate replicated-collection adapter in Ontahi.

## Verification

- The first observation scans the configured history and establishes a complete frontier.
- A later observation with no provider changes fetches one boundary page and reuses all accepted
  evidence records.
- Editing an old merged PR advances it into the observed window and updates its Atlas evidence.
- Removing all supported directives deletes its cached evidence record.
- Equal `updated_at` values cannot cause a missed PR.
- GitHub failures do not replace accepted evidence with a partial result.
- Full and incremental observation produce the same normalized evidence collection.

## Decisions

- Use provider `updated_at` as an observation frontier, not as domain identity.
- Keep the evidence replica distinct from projected `pull_requests`; ordinary PR observations are
  still needed to advance the frontier even when they produce no evidence row.
- Store only normalized relevant records plus the frontier, while applying negative observations to
  remove records whose directives disappeared.
- Keep projection publication atomic and full in this plan.

## Open Questions

1. Should a later webhook adapter enqueue `pull_request.edited` directly, or is frontier polling on
   the next reconciliation sufficient for the first production slice?
2. Should GitHub ETags complement `updated_at` after the replicated collection behavior is proven?
3. Which portion belongs in a generic Ontahi replicated-collection adapter after Atlas validates
   failure and repair semantics?

## Closure / Evolution

Current. Created from the production observation checkpoint in Plans 153 and 156. Incremental
semantic assembly remains the following optimization; this plan first removes repeated remote
collection reconstruction and establishes GitHub evidence as another explicit replicated Source.
