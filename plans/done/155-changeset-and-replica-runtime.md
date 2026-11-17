# 155. ChangeSet and replica runtime

Status: done

## Summary

Introduce durable, provider-neutral ChangeSets that advance one Source replica from an exact base
revision to a target revision and can be replayed idempotently or rejected safely when lineage has
gaps.

## Context

Source-incremental reconciliation currently replaces one complete Source partition. Most commits
change only a few records. A ChangeSet supplies the missing unit between provider observation and
semantic projection, while Unit of Work continues to own execution lifecycle and Session/Principal
attribution.

## Proposed Form

```ts
type SourceChangeSet = {
  id: string;
  sourceId: string;
  baseRevision: string;
  targetRevision: string;
  unitOfWorkId?: string;
  sessionId?: string;
  principalId?: string;
  operations: SourceOperation[];
  provenance: ProviderProvenance;
};
```

File Sources initially support create, update-content, delete, and move. Entity/value Sources use
field operators inside update operations, including set/unset and later collection-specific
insert/remove/move/replace. Filesystem move and collection `$move` are distinct operations at
different semantic layers.

## Scope

- ChangeSet identity, attribution, provenance, ordering, and idempotency.
- Base-revision compare-and-apply invariants.
- Snapshot fallback for missing or unverifiable history.
- Checkpoints, replay, diagnostics, and immutable application history.
- Git file-delta adapter and current source-record adoption.
- Equivalence verification against full source observation.

## Non-Goals

- Concurrent multi-master merge.
- Offline editing.
- Generic CRDT operators.
- Partial semantic graph publication in the first slice.

## Execution Slices

1. [x] Define ChangeSet and operation schemas plus Unit of Work relationships.
2. [x] Persist observed ChangeSets and application outcomes.
3. [x] Derive a Git file ChangeSet between accepted revisions.
4. [x] Apply it with exact revision and record preconditions.
5. [x] Retain full semantic publication from the converged record set initially.
6. [x] Run incremental/full equivalence checks and retain full fallback.

## Verification

- Duplicate delivery/application is a no-op.
- Base mismatch cannot mutate the replica.
- Create/update/delete/move converge to the same records as a full checkout.
- Attribution distinguishes Principal, Session, Unit of Work, provider event, and revision.
- A history gap selects full observation rather than guessing operations.

## Decisions

1. Runtime ChangeSets carry a portable `AtlasSource` Ref while persistence retains the legacy
   `source_id` during gradual Source-model adoption.
2. ChangeSet identity is a deterministic hash of Source, revision pair, and canonical operations;
   timestamps and delivery IDs are provenance, not identity.
3. A unique target Source Revision accepts at most one durable ChangeSet.
4. File move detection is deterministic and conservative: only a unique identical-content target
   becomes `move`; ambiguous cases remain delete/create without semantic guessing.
5. Git `push.before` must match the persisted base revision for incremental observation. A gap uses
   the existing complete snapshot path.
6. ChangeSet application converges source records; complete semantic parsing and atomic publication
   remain the correctness oracle for this slice.

## Closure / Evolution

Implemented for the global Git/Markdown webhook path. Atlas now derives deterministic file
ChangeSets, applies create/update/delete/move operations with content preconditions, persists
provider provenance and optional Unit of Work/Session/Principal attribution, and links one durable
application to the publishing Projection Revision. Duplicate delivery stays a no-op; target-revision
application is idempotent; base mismatch and push history gaps cannot mutate the replica.

The next optimization belongs to parsed semantic artifacts and dependency-aware invalidation.
Partial graph publication and Atlas-authored outbound ChangeSets remain future slices rather than
being hidden inside this runtime foundation.
