# 133. Inferred Item Mentions

Status: next

Definition level: shaped

## Summary

Turn high-confidence textual mentions of Atlas Items into quiet, navigable links and derived graph
connections. Infer from the vocabulary already present in Atlas rather than requiring WikiCase or
treating every capitalized phrase as a concept.

## Context

Atlas content already describes the same concepts represented by its graph, but many connections
remain trapped in prose unless an author writes an explicit `[[reference]]`. Automatically
recognizing known item titles and aliases would make documents wiki-like, improve discovery, and
produce useful backlinks for search and future agents.

Capitalization is not a reliable declaration: sentence starts, names, technologies, and generic
nouns would create noisy links. Explicit wiki links should remain the author's strongest signal;
inference should be conservative, derived, and visibly distinguishable from declared relations.

## Scope

1. Build a normalized vocabulary from item titles and explicitly declared aliases during snapshot
   construction.
2. Detect exact title and alias mentions case-insensitively, preferring the longest match.
3. Ignore existing links, code, URLs, headings, frontmatter, self-mentions, and ambiguous or overly
   short vocabulary.
4. Store each match as a derived mention with source, target, matched text, location, inference kind,
   and confidence; do not promote it to `related`, `supports`, or another declared relation.
5. Render inferred mentions as subtle navigable links and expose derived backlinks separately from
   authoritative relations.
6. Bound visual noise by linking at most the first occurrence of a target per section.

## Non-Goals

1. No WikiCase or initial-capital convention.
2. No LLM inference in the first slice.
3. No silent source Markdown rewrites.
4. No automatic promotion of inferred mentions into durable typed relations.

## Proposed Form

```ts
type InferredItemMention = {
  sourceNodeId: string
  targetNodeId: string
  matchedText: string
  start: number
  end: number
  section?: string
  inference: 'exact-title' | 'alias'
  confidence: number
}
```

Signal hierarchy:

1. `[[Item]]`: explicit author intent.
2. Inferred mention: high-confidence textual connection.
3. Typed relation: durable semantic claim such as `supports` or `contains`.

## Execution Slices

- [ ] Define alias metadata, ambiguity rules, and the derived mention snapshot contract.
- [ ] Extract mentions from Markdown syntax nodes during snapshot construction.
- [ ] Render inferred links without disturbing explicit links or code-oriented content.
- [ ] Add inferred backlinks and use mentions as a low-weight search signal.
- [ ] Verify overlap, ambiguity, self-reference, punctuation, and section-level deduplication.
- [ ] Dogfood against Atlas-owned content and record false positives before expanding inference.

## Verification

- Exact multi-word titles link to the intended item regardless of capitalization.
- Longest matches win when vocabulary overlaps.
- Generic, ambiguous, and short terms remain plain text.
- Explicit links and typed relations retain distinct presentation and authority.
- Mention extraction is deterministic and snapshot-time, not repeated during rendering.
- `pnpm verify` and `git diff --check` pass when implemented.

## Open Questions

1. Where should aliases live: item frontmatter, a derived synonym index, or both?
2. What minimum specificity should allow a one-word title to participate automatically?
3. Should inferred backlinks appear in Context, a dedicated Mentions section, or only on demand?
4. Which confidence threshold should later LLM-proposed semantic paraphrases require before display?

