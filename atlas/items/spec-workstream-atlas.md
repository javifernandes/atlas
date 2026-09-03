---
id: spec-workstream-atlas
kind: project
title: Workstream Atlas
status: shaping
horizon: now
supports:
  - bookops
  - ontahi
  - spec-workstream-atlas
relatedPlans:
  - plans/done/104-atlas-source-shape-v0.md
  - bookops://plans/133-atlas-standalone-extraction
  - plans/done/101-workstream-atlas-semantic-source.md
  - plans/current/119-atlas-authentication-and-workspace-visibility-v0.md
---

The Workstream Atlas is the emerging tool and language for navigating product, framework, UX, design, management, and implementation concerns as one semantic map.

It started from BookOps planning pressure, but it is modeled as a root project because it can support BookOps, Ontahi, and other spec-driven projects.

## Current Implementation

Atlas is independently implemented in the public
[`javifernandes/atlas`](https://github.com/javifernandes/atlas) repository and deployed at
[`atlas-ten-ebon.vercel.app`](https://atlas-ten-ebon.vercel.app/). Atlas owns this project model and
its active product and implementation plans. BookOps, Ontahi, and other repositories remain
federated sources for the plans and items they own.

## Top-Level Items

1. [`Atlas Model`](./spec-workstream-atlas/atlas-model.md)
2. [`Atlas Experiences`](./spec-workstream-atlas/atlas-experiences.md)
3. [`Implementation Evidence`](./spec-workstream-atlas/implementation-evidence.md)
4. [`Operating Principles`](./spec-workstream-atlas/operating-principles.md)
5. [`Operating Practice`](./spec-workstream-atlas/operating-practice.md)
6. [`Access And Identity`](./spec-workstream-atlas/access-and-identity.md)
