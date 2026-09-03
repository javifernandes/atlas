---
id: spec-workstream-atlas.operating-practice.visual-verification-evidence
kind: practice
title: Visual Verification Evidence
parent: spec-workstream-atlas.operating-practice
status: shaped
horizon: now
supports:
  - spec-workstream-atlas.operating-practice
relatedPlans:
  - plans/done/123-visual-verification-evidence.md
---

Visual Verification Evidence preserves the browser states used to validate user-visible changes
so reviewers can inspect the result directly from the Pull Request. When browser verification is
part of a Plan, focused final-state screenshots belong under
`docs/evidence/<plan-number>-<plan-slug>/` and the relevant images are embedded in a
`## Visual evidence` section of the PR body.

The evidence should demonstrate the changed behavior with the smallest useful set of states. Both
themes, multiple breakpoints, or before-and-after pairs are included only when they materially
test the change. Captures must not expose secrets, personal data, or irrelevant local state.

Screenshots complement executable verification and Atlas evidence bindings; they replace neither.
The Plan records what was checked, automated tests protect behavior, and `Atlas-Implements` or
`Atlas-Shapes` binds the merged implementation to registered Atlas targets.
