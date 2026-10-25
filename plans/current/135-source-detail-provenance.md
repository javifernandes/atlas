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
- Let readers copy the repository-relative source path for direct IDE navigation.
- Preserve list metadata below the scalar summary without adding card borders.
- Resolve metadata references into human-readable, navigable Atlas item names when their targets
  exist in the projected graph.
- Refine the full-detail reading rail so its current viewport remains legible across themes and
  follows scrolling without discrete jumps, while staying absent when the content does not
  overflow.
- Let the Atlas loading mark carry its own restrained, organic progress motion instead of adding a
  separate generic activity indicator.

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

The visual follow-up uses a fixed mid-gray viewport marker for reliable light/dark contrast and
interpolates its progress with animation frames. The Atlas loading mark now constructs itself in
sequence: the central node draws clockwise, then each connection and endpoint appears in turn.
The completed graph rests briefly and fades as a whole, allowing the stroke state to reset while
invisible instead of visibly rewinding. The previous three-dot spinner is removed and
reduced-motion behavior is preserved.

Theme selection now runs in the document head before first paint, using the stored preference or
the system preference, so a dark session no longer flashes the light loading surface. Loader motion
uses CSS-driven SVG stroke progress without scaling or deforming the Atlas mark, keeping its
geometry stable throughout the short splash interval.

The reading-position rail now renders only for genuinely overflowing detail content, removing the
inactive track from short tabs. Source provenance also exposes a quiet copy action beside the
repository link so the displayed source path can be pasted directly into an IDE.

Source relationship values now resolve through canonical paths and semantic IDs. Resolved values
render as human-readable internal navigation, including the compact qualified code for Plans,
while unresolved values remain visible as source text rather than being discarded.

Browser code rendering now loads Shiki's web bundle explicitly, so recognized fenced languages
such as TypeScript produce theme-aware token colors instead of silently remaining in the plain-text
fallback.
