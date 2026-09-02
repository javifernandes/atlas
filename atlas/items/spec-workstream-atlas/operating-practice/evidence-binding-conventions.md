---
id: spec-workstream-atlas.operating-practice.evidence-binding-conventions
kind: practice
title: Evidence Binding Conventions
parent: spec-workstream-atlas.operating-practice
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.operating-practice
  - spec-workstream-atlas.atlas-model.evidence-binding
  - spec-workstream-atlas.implementation-evidence
relatedPlans:
  - plans/current/102-workstream-atlas-implementation-evidence.md
---

Evidence Binding Conventions make author intent legible to Atlas at the GitHub boundary. The
canonical operational contract lives in
[`docs/atlas-evidence-binding-guidelines.md`](../../../../docs/atlas-evidence-binding-guidelines.md)
and is copied into each federated source repository so humans and agents encounter the same syntax
where they prepare commits and Pull Requests.

The merged PR body is the current authoritative assertion surface. `Atlas-Implements` connects
implementation to intended work; `Atlas-Shapes` records a change to durable system form. Commit
trailers may preserve the same language, but remain supplementary until Atlas observes commits.

Repository copies are projections of this Atlas-owned practice, not independent variants. Evolve
the canonical guideline first, then synchronize the copies. A binding records evidence and
provenance; it does not mutate curated Plan or Item status.
