# 157. Atlas editing and Git write-back

Status: backlog

## Summary

Let a user edit Git-backed Atlas Entities through Atlas while Git remains the accepted authority:
produce an attributable ChangeSet against an exact base revision, publish it as a commit/branch/PR,
and confirm it through the normal inbound replication path.

## Context

Read-only source federation is not the final Atlas experience. Editing is a major usability step,
but introducing a hidden second canonical store would create ambiguous ownership and merge rules.
The replication model can instead make Atlas an authoring surface whose accepted writes flow through
the Source's provider.

## Scope

- Editing Unit of Work, Principal and Session attribution.
- Base revision and optimistic concurrency.
- Semantic edits compiled to source-level ChangeSets.
- Preview, validation, commit/branch/PR publication, and confirmation.
- Rebase/conflict outcomes and recovery of pending outbound work.
- Permissions and provider installation authority.

## Non-Goals

- Silent direct writes to protected branches.
- Offline multi-writer merge.
- Treating an unconfirmed local proposal as the accepted Git Source Revision.

## Proposed Form

```txt
Entity edit
  -> Unit of Work(base revision, principal, session)
  -> semantic ChangeSet
  -> source patch preview
  -> Git branch / Pull Request
  -> provider revision observed
  -> inbound ChangeSet confirms projection
```

Pending outbound edits are Atlas-owned durable state. They are related to, but not yet revisions of,
the Git Source. Drift from the base revision produces an explicit conflict/rebase state.

## Execution Slices

1. Define pending outbound ChangeSet lifecycle and authority semantics.
2. Implement read-only patch preview for one Entity/source format.
3. Publish a branch and PR through the GitHub App with explicit user confirmation.
4. Correlate inbound provider observation with the originating Unit of Work.
5. Add revision-drift and conflict UX.

## Verification

- Every outbound change is attributable and previewed before provider mutation.
- Base revision drift cannot silently overwrite newer source changes.
- Git provider confirmation, not local optimism, advances accepted source lineage.
- A failed publication preserves recoverable pending work without changing the accepted projection.

## Closure / Evolution

Deferred until Plans 154 and 155 establish Source and ChangeSet contracts. Parent Plan 153.
