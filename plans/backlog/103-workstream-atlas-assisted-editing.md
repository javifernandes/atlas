# 103. Workstream Atlas Assisted Editing

Status: idea

## Summary

Add LLM-assisted editing to the Workstream Atlas so users can ask for semantic reorganizations, status reviews, new nodes, plan bindings, summaries, and cleanup proposals directly from the map.

The first version should be proposal-based: the LLM returns structured edits and markdown diffs for human review. Direct repo mutation should be a later, explicitly authorized mode.

## Context

The atlas is becoming the shared product language across product, design, engineering, QA, and management. But maintaining the tree still requires manual markdown editing and a lot of semantic judgment.

LLM assistance can help with the gardening work:

1. extract a new node from a cluster of plans,
2. move plans under a better capability,
3. detect duplicated or transitive relationships,
4. rewrite summaries in a consistent voice,
5. suggest missing children, evidence, or metadata,
6. review whether a plan status matches code, checklists, tests, and implementation evidence,
7. propose a refactor of a branch without applying it blindly.

This is related to Atlas Shaping, but it is the user-instructed mode: the user asks for a change or interpretation from inside the Atlas UI.

## Scope

Define the first assisted-editing surface for Atlas.

The v0 should build context from markdown on demand, produce a reviewable proposal, and stop before direct write authority.

## Proposed Form

From a selected atlas item, show an `Ask Atlas` action.

The user can type a request or choose quick actions:

1. `Extract child`
2. `Move under...`
3. `Group related plans`
4. `Find missing evidence`
5. `Review status`
6. `Rewrite summary`
7. `Suggest cleanup`

The assistant response should render as a reviewable proposal:

1. intent,
2. affected nodes and files,
3. proposed semantic changes,
4. markdown diff,
5. graph preview,
6. risks and open questions,
7. actions: `Apply`, `Edit prompt`, `Discard`, `Ask Codex`.

## Provider Model

Separate LLM providers from agent backends.

```ts
type AtlasEditProvider = {
  proposeEdit(input: AtlasEditRequest): Promise<AtlasEditProposal>;
};

type AtlasAgentBackend = {
  runTask(brief: AtlasEditBrief): Promise<AtlasAgentResult>;
};
```

Provider adapters produce structured proposals. Agent backends can perform repo work.

## Context Strategy

Start stateless.

Every request should build context from markdown:

1. atlas schema and editing rules,
2. selected node,
3. parent, children, and siblings,
4. direct relations and related plans,
5. top search matches from `atlas/items/**` and `plans/**`,
6. relevant repo paths, tests, stories, and implementation evidence when the request requires status review,
7. constraints about IDs, statuses, horizons, and relationship semantics.

This keeps behavior reproducible and git-friendly. Long-running agents can be introduced for larger edits once the proposal model is trusted.

## Prompting Rules

The system prompt should ask the model to:

1. preserve existing IDs unless renaming is explicitly requested,
2. avoid inventing files, plans, or statuses,
3. prefer minimal markdown patches,
4. explain semantic moves in product language,
5. produce machine-readable proposals,
6. distinguish confirmed evidence from inference,
7. flag uncertainty instead of applying speculative structure.

## Execution Slices

1. Define `AtlasEditRequest`, `AtlasEditProposal`, and patch payload types.
2. Build a context assembler for one selected node.
3. Add a read-only `Ask Atlas` panel with mock or local provider output.
4. Render proposal cards and markdown diffs.
5. Do not write files from the UI yet.

## Later Slices

1. Add OpenAI provider configuration through env vars.
2. Add provider selection if multiple adapters exist.
3. Validate proposed patches against atlas schema before preview.
4. Apply accepted patches locally or through a server action.
5. Add branch/PR mode.
6. Add Codex agent backend for larger repo edits and verification.
7. Feed implementation evidence and PR history into context.
8. Add `Review status` as a first-class action that can audit a plan against code, tests, checkboxes, and related atlas evidence.

## Open Questions

1. Is the first provider OpenAI directly, an internal AI gateway, or a generic provider registry?
2. Should the UI support applying edits in production, or only in local/dev mode at first?
3. How should credentials be scoped for personal, team, and deployed environments?
4. When does a task graduate from proposal-mode LLM to Codex-style repo agent?
5. How much context is enough before the assistant starts overfitting to noisy historical plans?

## Verification

The first slice is useful when a user can select an Atlas item, ask a narrow semantic question, and receive a proposal that:

1. cites the source markdown it used,
2. distinguishes evidence from inference,
3. names affected atlas items and files,
4. shows a patch or structured edit payload,
5. can be discarded without mutating the repo.

## Closure / Evolution

Not closed. This plan should remain backlog until Atlas has enough stable source conventions and at least one manual proposal flow worth automating.
