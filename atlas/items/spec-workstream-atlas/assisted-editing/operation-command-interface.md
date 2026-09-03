---
id: spec-workstream-atlas.assisted-editing.operation-command-interface
kind: capability
title: Operation Command Interface
parent: spec-workstream-atlas.assisted-editing
status: idea
horizon: next
supports:
  - spec-workstream-atlas.assisted-editing
  - spec-workstream-atlas.assisted-editing.plan-status-review
  - spec-workstream-atlas.atlas-experiences.atlas-shaping
relatedPlans:
  - plans/backlog/103-workstream-atlas-assisted-editing.md
  - plans/backlog/105-atlas-shaping.md
  - plans/next/106-atlas-plan-reconciliation-operation.md
  - plans/done/111-atlas-as-ontahi-application.md
  - plans/done/124-implicit-personal-execution-streams-mvp.md
---

The Operation Command Interface lets a user invoke atlas and product operations in ordinary prose while Atlas resolves the request to a typed operation.

The important shift is that the LLM is not the domain model. It is a flexible command surface over operations that should remain inspectable, authorized, and reviewable.

Examples:

1. "Review this plan state" resolves to `ReviewPlanState`.
2. "Extract the follow-ups from this plan" resolves to a future follow-up extraction operation.
3. "Add a note about Nietzsche and eternal return to this chapter" resolves to a BookOps content operation when the target system exposes one.

Atlas should work without Ontahi, but Ontahi-backed systems make this interface stronger because entities, refs, operations, and relations already give the assistant a typed action language. The fuzzy prose layer can then spend more effort choosing the right operation and less effort reconstructing what the system is.

The first concrete command boundary is `AtlasItem.proposePlanLink`. It accepts existing Item and
Plan refs through the Ontahi Runtime Protocol and returns a reviewable Markdown diff without
applying it. This proves the typed operation path while leaving natural-language routing,
authentication, approval, and repository mutation for the broader interface.

Atlas exposes that boundary through the shared Next.js Runtime Protocol adapter from
`@ontahi/runtime-nextjs`. Atlas continues to own its dispatcher, installed family handlers, and
trusted request-context derivation; the adapter owns only HTTP parsing, protocol error status, and
response serialization. Legacy family-specific Fetch clients remain outside this server-boundary
change and continue to use their existing paths until their owning migration lands.

The first user-triggered mutation is `AtlasExecutionStream.close`. Its client uses the typed Ontahí
Operation hook and generic `/operations` adapter; `/operations` and the `operation` family under
`/runtime` share one Atlas dispatcher. That dispatcher resolves only operations explicitly marked
`exposure: 'bridge'`, so a `server-only` operation cannot become remotely callable merely because
its ID is known. Authenticated ownership is derived inside the operation from the invocation
Principal, never supplied as public input.
