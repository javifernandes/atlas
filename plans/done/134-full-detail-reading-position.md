# 134. Full Detail Reading Position

Status: done

## Summary

Replace the full-detail content area's native scrollbar chrome with a persistent, minimal reading
position rail: one quiet vertical line and a highlighted segment scaled to the visible portion and
current scroll position.

## Scope

- Preserve native wheel, trackpad, keyboard, and programmatic scrolling behavior.
- Hide only the full-detail content viewport's native scrollbar presentation.
- Keep the custom indicator visible across detail tabs and reset it when the item or tab changes.
- Respect reduced-motion preferences.

## Verification

- [x] The content viewport exposes an accessible reading-position scrollbar indicator.
- [x] The native scrollbar is visually hidden without disabling scrolling.
- [x] `pnpm verify` and `git diff --check` pass.

## Closure / Evolution

Closed on 2026-10-25. Full detail now keeps its content viewport's native scrolling mechanics but
hides platform scrollbar chrome. A persistent one-pixel rail and highlighted segment communicate
the visible proportion and current reading position, reset on item or tab changes, and avoid motion
under reduced-motion preferences. The rail sits inset from the content edge; its passive range is a
dim neutral gray and its active range uses a restrained translucent light gray rather than a
semantic product accent or a high-contrast white marker.

