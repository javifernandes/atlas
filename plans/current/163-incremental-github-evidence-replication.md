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
6. [x] Evaluate the behavior as a candidate replicated-collection adapter in Ontahi.

## Ontahi extraction brief

The merged Atlas implementation proves a provider-neutral runtime shape that is adjacent to, but
not identical with, the existing Materializer SPI:

```ts
interface ReplicatedCollectionObserver<Frontier, RecordChange> {
  observe(input: {
    acceptedFrontier: Frontier | null
    mode: 'bootstrap' | 'incremental' | 'repair'
  }): Promise<{
    changes: RecordChange[]
    targetFrontier: Frontier
    diagnostics: ReplicationDiagnostic[]
  }>
}
```

An Ontahi-owned provider plan should extract the shared runner invariants rather than the GitHub
adapter:

- canonical frontier comparison and atomic acceptance;
- idempotent positive and negative record changes;
- protection against stale writers and out-of-order observations;
- bootstrap, incremental observation, validation, and repair modes;
- common fetched, changed, reused, and resulting-record diagnostics;
- a complete accepted snapshot exposed to downstream Materializers.

Storage should be zero-configuration by default. Replica checkpoints and records should use the
same active Ontahi application storage as ordinary Entities, participating in its transaction and
portability model. A custom storage adapter remains an explicit escape hatch for split stores,
remote checkpoints, or specialized retention; it should not be mandatory ceremony for the common
case.

Atlas remains responsible for GitHub pagination, `updated_at` frontier semantics, normalized PR
payloads, and evidence derivation. After the Ontahi runtime exists, Atlas can replace its local
runner and PostgreSQL-specific orchestration while retaining those application behaviors. BookOps
should then validate the provider-neutral contract with a distinct remote collection before any
higher-level declarative Entity API is stabilized.

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
3. Should accepted replica records be ordinary addressable Entities or runtime-internal records
   stored through the same Entity storage contract?

## Closure / Evolution

Current. PR #117 landed the Atlas proof: a durable repository frontier, normalized relevant
records, inclusive incremental observation, idempotent positive and negative changes, stale-write
protection, and stage metrics. The first production run must bootstrap the replica; a later run
should demonstrate boundary-page observation and accepted-record reuse before this Plan closes.

The implementation is deliberately application-local. Evaluation exposed a reusable
`ReplicatedCollectionObserver`/runner capability that belongs in an Ontahi provider plan, with the
active Entity storage as its default persistence and a custom storage adapter only as an escape
hatch. Incremental semantic assembly remains the following Atlas optimization.
