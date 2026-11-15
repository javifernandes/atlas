---
id: spec-workstream-atlas.goal.legible-system-evolution
kind: goal
title: System Evolution Is Legible
parent: spec-workstream-atlas
status: active
horizon: now
supports: []
relatedPlans:
  - plans/current/102-workstream-atlas-implementation-evidence.md
  - plans/done/147-goal-model-v0.md
---

Atlas makes the path from desired outcomes through planned interventions to durable system form and
observed implementation legible in both directions.

Success does not require predicting the contents of a release. It means a person can understand
why a change exists, which Plans advanced the outcome, what model form those Plans shaped, and in
which implementation or package versions that form became available.

## Signals

1. Plans explicitly name the Goals they advance.
2. Durable Atlas Items retain the Plans that shaped them.
3. Pull requests and Changesets connect intent to implementation changes.
4. Component Versions and Releases show when those changes became available.
5. Navigation works from Goal to delivery evidence and back without making any one source pretend
   to own the whole history.

## Boundaries

This Goal does not require releases to act as roadmaps, every Plan to predict a target version, or
Goal progress to collapse into a percentage.
