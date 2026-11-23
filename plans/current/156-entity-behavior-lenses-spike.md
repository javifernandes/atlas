# 156. Entity behavior lenses spike

Status: current

## Summary

Test whether Atlas can make Entity behavior useful to both system designers and programmers without
turning Markdown or framework code into the semantic authority. Replace the Mermaid-only Entity
state view with a navigable Atlas state graph, and derive concise semantic pseudocode from the same
Operation contract used by Entity transitions.

## Context

Workspace Invitation now gives Atlas one sufficiently rich exemplar: named states, linked
Operations, availability rules, failures, effects, and invariants. The existing state diagram loses
Atlas links inside Mermaid labels, while the standalone Operation page repeats the contract as long
prose. Both problems are projections of one semantic model rather than reasons to author more data.

This spike stays deliberately below Interaction composition. It improves the micro-level Entity and
Operation reading experience that an Interaction graph can later drill into.

## Scope

- Render Entity states and Operation transitions with an Atlas-owned, ELK-laid-out SVG lens.
- Resolve authored Operation references once and make transition labels navigable.
- Project Operation sections into compact semantic pseudocode for a programmer-facing reading.
- Bind preserved invariant names to the receiver Entity's invariant declarations.
- Keep canonical Markdown visible as evidence and fallback.
- Use Workspace Invitation and Invite as the end-to-end exemplar.

## Non-Goals

- Mapping an Operation to TypeScript, Python, or repository source code.
- Generating executable Ontahí Operations from Atlas Markdown.
- Defining a general programming language or expression evaluator.
- Replacing Interaction Activity Graphs or their execution model.

## Execution Slices

1. [x] Record the Entity-state and Operation-pseudocode projection boundary.
2. [x] Parse the smallest typed Operation contract needed by the pseudocode lens.
3. [x] Render a custom navigable state graph from Entity states and transitions.
4. [x] Render semantic pseudocode for standalone Operations.
5. [x] Verify Workspace Invitation and Invite locally, including link navigation.
6. [x] Resolve preserved invariants as typed, validated, navigable Entity-scoped references.

## Verification

- Workspace Invitation state names remain readable and every linked transition opens its Operation.
- Invite pseudocode exposes receiver, actor, requirements, transition/effects, failures, and
  preserved invariants without pretending to be executable TypeScript.
- Missing or partial Operation sections degrade without invented semantics.
- Preserved invariants navigate to their owning Entity; dangling references remain visible as
  unresolved model gaps.
- Focused parser, projection, and viewer tests pass.
- `pnpm verify` passes before a PR.

## Decisions

1. An Operation is the semantic behavior; a state transition is one successful effect of invoking
   it, not a synonym for the Operation.
2. State graph and pseudocode are derived lenses over typed Entity and Operation models.
3. Atlas owns the visual projection so semantic references remain navigable; ELK owns layout only.
4. Pseudocode describes domain intent and deliberately avoids host-language syntax commitments.
5. Runtime and source-code realization links stay deferred until this semantic reading proves useful.

## Open Questions

1. Should Operation pseudocode eventually become an editable authoring form or remain derived?
2. Should a state edge expose failures and guards inline, on selection, or through the Operation?
3. Can the same Operation projection later serve Interaction node drill-down without duplication?

## Closure / Evolution

Keep this plan as a spike until both lenses have been exercised against Workspace Invitation. If the
projection holds, fold the durable rules into Entity and Operation and return to the broader
Interaction exemplars.
