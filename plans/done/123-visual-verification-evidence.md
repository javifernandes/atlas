# 123. Visual Verification Evidence

Status: done

## Summary

Preserve focused browser screenshots for user-visible UI work and surface them in Pull Requests so
the visual states already inspected during implementation become durable review evidence.

## Context

Plans already require proportionate verification, and visual changes are commonly exercised in a
running browser. When those browser states remain only in the implementing agent's session,
reviewers cannot inspect the same result without recreating the environment.

## Scope

1. Add a repository instruction for saving final-state browser captures under `docs/evidence/`.
2. Require review-relevant captures to be embedded in a `## Visual evidence` PR section.
3. Record the distinction between visual verification, executable tests, and Atlas evidence
   bindings in the smallest durable operating-practice item.
4. Apply the practice to Plans 120–122 in their existing implementation PR.

## Non-Goals

1. Do not require screenshots for non-visual or Markdown-only work.
2. Do not prescribe exhaustive theme, viewport, or before-and-after matrices.
3. Do not treat screenshots as a replacement for tests or evidence-binding directives.
4. Do not preserve captures containing secrets, personal data, or irrelevant local state.

## Execution Slices

- [x] Register the practice in `AGENTS.md` and Atlas operating practice.
- [x] Capture the final Board, full-item, and Map states for Plans 120–122.
- [x] Link each capture from its implementing Plan and embed the set in PR #18.
- [x] Run focused source/snapshot verification and `git diff --check`.

## Verification

- [x] Browser captures visibly demonstrate the implemented states:
  - [Ontahi-scoped Plan Board](../../docs/evidence/120-board-project-filter/board-ontahi.jpg)
  - [Full-item project badges](../../docs/evidence/121-full-item-project-badges/full-item-project-badges.jpg)
  - [Plan layer in Map](../../docs/evidence/122-plan-centered-execution-projection/map-plan-layer.jpg)
- [x] `pnpm test -- src/atlas/sources/markdown-source.test.ts src/atlas/markdown/build-snapshot.test.ts`
- [x] `git diff --check`

## Closure / Evolution

Atlas now asks agents to preserve the final browser states that materially demonstrate a visual
change and to place them directly in the PR review path. The first evidence set covers the
project-scoped Plan Board, a genuinely multi-project full-item header, and the visually distinct
Plan layer in Map.

The practice deliberately stays proportional: additional themes, breakpoints, and before/after
pairs remain useful when they test the change, not as a mandatory screenshot matrix.
