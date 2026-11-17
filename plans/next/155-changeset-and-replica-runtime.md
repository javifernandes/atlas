# 155. ChangeSet and replica runtime

Status: next

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

1. Define ChangeSet and operation schemas plus Unit of Work relationships.
2. Persist observed ChangeSets and application outcomes.
3. Derive a Git file ChangeSet between accepted revisions.
4. Apply it transactionally to source records.
5. Parse changed records and retain full semantic publication initially.
6. Run incremental/full equivalence checks and retain full fallback.

## Verification

- Duplicate delivery/application is a no-op.
- Base mismatch cannot mutate the replica.
- Create/update/delete/move converge to the same records as a full checkout.
- Attribution distinguishes Principal, Session, Unit of Work, provider event, and revision.
- A history gap selects full observation rather than guessing operations.

## Closure / Evolution

Not started. Depends on Plan 154; parent Plan 153.
