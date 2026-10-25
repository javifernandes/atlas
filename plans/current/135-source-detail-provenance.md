# 135. Source Detail Provenance

Status: current

## Summary

Make the Source tab read as part of the full-detail surface rather than a card nested inside it,
and expose the authoritative repository file behind every projected item.

## Context

The current Source tab wraps frontmatter in a second bordered panel, repeats hierarchy already
shown by detail navigation, underuses horizontal space, and does not let a reader reach the source
Markdown. Snapshot nodes retain a source identifier and path but not enough repository provenance
for the browser to build an exact source-control link.

## Scope

- Flatten source metadata into the modal content surface.
- Give common scalar fields a compact, horizontal reading order.
- Remove `parent` from the metadata view because parent navigation already owns that relationship.
- Humanize camelCase and compact metadata names such as `RelatedPlans` and `TypeOf`.
- Show the source file and observed revision, with the filename linking to GitHub.
- Preserve list metadata below the scalar summary without adding card borders.

## Non-Goals

- Editing source metadata from Atlas.
- General repository browsing.
- Resolving every semantic reference in frontmatter into an Atlas navigation link in this slice.

## Proposed Form

Source provenance is projected with each document node: repository, repository-relative path,
revision, and revision kind. The Source tab presents provenance first, then compact scalar metadata,
then multi-value relationships. Only quiet delimiters separate groups.

## Execution Slices

1. Carry source provenance through normalization and snapshot construction.
2. Add a stable GitHub file-link builder and provenance rendering.
3. Flatten and reorder Source metadata, omitting duplicated parent information.
4. Verify snapshot provenance and the full application.

## Verification

- Snapshot tests preserve repository, path, and git revision.
- Type checking and viewer tests pass.
- `pnpm verify` passes.
- `git diff --check` passes against the PR base.

## Closure / Evolution

Open while implementing the first visual and provenance slice.

## Checkpoint — 2026-10-25

The first slice is implemented on `codex/source-detail-layout`. Source metadata now shares the
modal content plane, omits duplicated parent data, humanizes compound field names, and separates
scalar identity from multi-value relationships with quiet dividers. Snapshot nodes carry source
repository, path, revision, and revision kind. The source filename links to the observed GitHub
repository at the exact git revision when available and to `main` for a local content revision.
`sourceCommit` supplied by the document remains the displayed semantic commit and is not duplicated
by local projection provenance.
