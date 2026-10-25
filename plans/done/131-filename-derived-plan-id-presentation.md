# 131. Filename-Derived Plan ID Presentation

Status: done

## Summary

Make the stable Plan key encoded at the start of each Plan filename visible as a distinct,
source-qualified visual element wherever Atlas presents a Plan title.

## Context

Atlas already relies on filename prefixes such as `125a` as stable Plan keys, but the UI either
re-parses them locally or leaves them embedded in undifferentiated title text. The projection should
carry that identity explicitly so every view can render it consistently.

## Scope

- Project the filename-derived key and owning source on Plan nodes.
- Introduce one reusable Plan title treatment for the key and human title.
- Apply it across Atlas exploration and Session planning surfaces.
- Preserve readable accessible names and search aliases.

## Non-Goals

- Renaming Plan files or changing canonical Plan URIs.
- Requiring numeric keys for unnumbered or externally shaped Plan records.

## Proposed Form

Render a compact monospace ID plate before the human title. Qualify the local key with a stable
repository prefix (`ATL-101`, `BOK-101`, or `ONT-101`) so federated Plans cannot collide. Keep the
title primary, use a quiet sky accent for identity, and allow the pair to truncate or wrap according
to its host surface.

## Execution Slices

- [x] Add the filename-derived Plan key to the snapshot node contract.
- [x] Add and test the shared Plan title treatment.
- [x] Adopt the treatment across map, board, detail, search, and Session surfaces.
- [x] Verify the application and close the Plan.
- [x] Qualify Plan keys with stable source/repository prefixes.
- [x] Extend search aliases and verification for federated IDs.
- [x] Surface qualified IDs explicitly in Plan detail headings.
- [x] Align child navigation with the quieter parent-navigation language.
- [x] Make global search modal-aware and open results directly in full detail.

## Verification

- Component tests distinguish numbered Plans from non-Plan nodes and unnumbered Plans.
- Snapshot tests prove the projected key comes from the filename.
- `pnpm verify` passes.

## Closure / Evolution

Closed on 2026-10-25. Plan nodes project their filename-derived key and owning source. The shared
title treatment renders collision-safe IDs (`ATL-…`, `BOK-…`, and `ONT-…`) across map, board,
detail, search, relationship, and Session surfaces. Full detail uses the same qualified heading,
child navigation now mirrors the lightweight parent treatment while using each child's item type
instead of a repeated relation label, and global search layers above an
open detail modal and replaces it directly on selection. Search exposes item types at the right
edge of each result and supports active-result navigation with arrow keys and Enter. It accepts qualified IDs and local
number aliases, while legacy snapshots retain path-based fallbacks. `pnpm verify` passes.

Scrollable item panels now share a subtle overflow affordance that dims the obscured edge and shows
the number of remaining items with a directional arrow. The search results exercise the vertical
form, while child navigation exercises horizontal start/end forms.
The hint's dimming is localized behind its badge rather than spanning the viewport. Keyboard result
navigation clamps at list boundaries, clears pointer-hover styling while active, and scrolls only
the exact distance needed to reveal the adjacent result.
