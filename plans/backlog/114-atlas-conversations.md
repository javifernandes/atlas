# 114. Atlas Conversations

Status: backlog

Definition level: seed

Parent plan: [113. BookOps Conversations Capability Extraction](bookops://plans/113-bookops-conversations-capability-extraction)

## Summary

Let people discuss Atlas items, plans, evolution notes, and proposed changes in place.

Atlas is becoming a shared thinking surface. The next natural layer is conversation anchored to the thing being shaped: a plan, model item, experience, capability, relation, evidence binding, or closure note.

## Context

Today, the conversation happens outside Atlas: in Codex chats, Slack, PRs, or memory. That works while the loop is small, but it loses the connection between a discussion and the model item it changes.

If BookOps conversations become a reusable Ontahi capability, Atlas can consume that package instead of inventing its own comment system.

## Scope

Define the first Atlas surfaces where conversations would matter.

Likely anchors:

1. `AtlasItem`
2. `Plan`
3. `EvolutionSignal`
4. `EvidenceBinding`
5. `Proposal`
6. `Relation`

Likely actions:

1. discuss this item,
2. create a plan from this idea,
3. dismiss this idea,
4. ask for status review,
5. link evidence,
6. resolve a discussion after a plan lands.

## Non-Goals

1. Do not implement Atlas conversations before the reusable package exists.
2. Do not design the full collaboration UX yet.
3. Do not replace PR discussion or Codex chat.
4. Do not require a hosted Atlas server in the first exploration.

## Proposed Form

The first UI shape could be modest:

```txt
Atlas detail panel
  Overview
  Evolution
  Context
  Conversations
  Source
```

The conversation tab should understand the selected item and offer domain-aware prompts:

1. "turn this into a plan",
2. "mark this as no longer relevant",
3. "ask Codex to review current status",
4. "link this to another atlas item."

## Execution Slices

1. Identify which Atlas entities can act as conversation anchors.
2. Define how conversation state is stored for markdown-first Atlas.
3. Add a read-only mock conversation tab to test placement.
4. Wire the reusable conversation package when plan 113 lands.
5. Add one domain-aware action from a conversation thread.

## Verification

- [ ] A discussion can attach to an Atlas item without losing the item context.
- [ ] The same conversation package can still serve BookOps.
- [ ] Conversations can produce or link work items.
- [ ] Resolved conversations remain useful as evolution history.

## Decisions

1. Conversations should be anchored to Atlas entities, not only pages or routes.
2. The first Atlas version can be local/proposal-based.
3. The package extraction should drive the real implementation boundary.

## Open Questions

1. Should Atlas conversations live in git, a database, or both?
2. How should local-only Atlas use work without a hosted server?
3. Can a conversation thread become evidence in the Evolution tab?
4. How should Codex/LLM turns appear alongside human comments?

## Closure / Evolution

Not started. This is intentionally less defined than the preceding package plans.
