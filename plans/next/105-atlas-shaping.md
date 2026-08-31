# 105. Atlas Shaping

Status: idea

## Summary

Atlas Shaping is the experience of continuously giving form to the living atlas model: first ideas, plans, prototypes, implementation evidence, project extraction, and later reinterpretation.

It treats ontology maintenance as ongoing product work, not as a one-shot migration. A project often does not start with perfect projects, entities, experiences, and capabilities. They emerge from feature work, implementation pressure, abandoned plans, prototypes, and later reflection.

Re-shaping is one mode of shaping: the explicit reinterpretation that happens after a change, merge, plan closure, drift discovery, or user-guided review.

## Context

The user-facing promise:

> "Show me what this push or plan changed in the conceptual model of the system, and propose the atlas updates needed to keep our product memory honest."

This is related to assisted editing, but it is broader:

1. assisted editing is the UI and agent interaction surface,
2. shaping is the domain workflow that gives form to atlas items,
3. re-shaping is the triggered workflow that detects change, reconstructs meaning, proposes ontology deltas, and version-controls the result.

Atlas started as a passive renderer over plans and markdown items. The next product step is to make it active: it should help interpret change, propose model updates, and keep the semantic source from drifting away from real work.

## Scope

Define a v0 architecture and product language for Atlas Shaping.

The first useful flow should be manual and reviewable: choose an item or plan, ask Atlas to reconstruct what changed or what remains, and receive a proposal that can become markdown edits or a PR.

Push/merge automation belongs in the same architecture, but it should not be required for the first valuable slice.

## Item Language

`node` is a useful technical term for graph rendering.
The current product noun is `atlas item`.

An atlas item is a durable conceptual thing that can emerge, be explored, materialize, gain evidence, drift, split, merge, be promoted, or be retired.
Item kinds include:

1. project,
2. experience,
3. model,
4. practice,
5. capability,
6. entity,
7. operation,
8. artifact,
9. policy,
10. evidence group,
11. work item.

A project is also an atlas item. BookOps, Ontahi, and Workstream Atlas are examples: they started as work inside another system or repo, then gained enough independent identity to be managed as project-level items.

## Project Items And Repos

A project item may bind to one or more repositories or repo paths.

Examples:

1. BookOps currently maps to the BookOps repo.
2. Ontahi still partly lives inside the BookOps repo, but also has `ontahi-book-of-style` and `ontahi-library`.
3. Workstream Atlas currently lives inside BookOps, but may become a separate project while still being managed in the same atlas.

This binding between atlas items and repositories is the bridge toward implementation evidence: once Atlas knows which repos and paths belong to a project or item, it can inspect code, tests, stories, docs, and PRs as evidence of the item's current form.

The v0 should not over-model this. It only needs to recognize repo/path binding as an emerging capability.

## Proposed Form

Atlas Shaping should treat change as a proposal-producing workflow:

```txt
change or user request
  -> shaping run
      -> assemble plan / atlas / code context
      -> apply interpretation skills
      -> produce proposal
      -> human review
      -> markdown patch / PR / later atlas version
```

The product surface should include item-scoped boards.

The global atlas map is useful for seeing the whole living system, but it should not become the only planning surface.

Each atlas item can project its related work into a local evolution board:

1. Past: materialized items, done plans, decisions, and evidence.
2. Now: active branches, current sub-items, and tensions that are shaping the present.
3. Next: promoted branches that look like the next concrete work.
4. Later: backlog, research, ideas, possibilities, questions, and not-yet-grounded branches.

This avoids the one-board problem: BookOps, Ontahi, Atlas, and their nested experiences can all share one conceptual map while still letting a selected item act like its own planning sphere.

The first UI can treat the `Evolution` tab as this board-like projection. Later versions can expose explicit board/list/map views over the same relationship data.

The architecture has seven parts.

### 1. Change Intake

Start with a GitHub App or webhook listener that reacts to pushes and PR merges.

The intake should capture:

1. repository,
2. branch and commit range,
3. changed files,
4. whether files are plans, atlas items, source code, tests, stories, or docs,
5. actor and trigger source.

The first implementation can also support a manual trigger from the Atlas UI for a selected item or branch.

### 2. Durable Operation

Each re-shaping trigger starts an `AtlasShapingRun`.

The run needs durable state because it may:

1. fetch repo data,
2. inspect a diff,
3. assemble context,
4. call one or more LLM providers,
5. optionally invoke a Codex-style repo agent,
6. produce a proposal,
7. wait for human review,
8. update status after a PR is opened or closed.

This should probably reuse the Ontahi durable operation direction rather than inventing Atlas-only task machinery.

### 3. Repo Access

The run needs a repo workspace adapter.

V0 options:

1. GitHub API reads changed markdown and nearby files without cloning.
2. Ephemeral checkout clones the repo at the target commit.
3. Codex agent backend works in a local or remote workspace and can run repo tools.

The v0 should prefer read-only GitHub/API context for cheap proposals, then escalate to an agent workspace only when code inspection, tests, or file edits are needed.

### 4. Interpretation Skills

Re-shaping should be composed from focused interpretive skills, not one giant prompt.

Initial skills:

1. `reconstruct-shape-evolution`: for a known atlas shape, find plans, decisions, tensions, evidence, and future signals that shaped it.
2. `discover-shapes`: find project, entity, concept, operation, artifact, practice, and policy candidates in plans and code.
3. `discover-relations`: find `contains`, `supports`, `shaped-by`, `typeOf`, and other relation candidates.
4. `discover-experiences-and-capabilities`: find user-facing experiences and service capabilities that are emerging from plan clusters.
5. `review-item-drift`: compare changed plans/code against existing atlas items and identify stale, missing, or contradictory model structure.

Each skill should return cited observations and proposed atlas operations, not raw prose only.

### 5. Provider And Agent Layers

Separate LLM providers from repo agents.

```ts
type AtlasShapeProvider = {
  propose(input: AtlasShapeContext): Promise<AtlasShapeProposal>;
};

type AtlasRepoAgent = {
  run(input: AtlasRepoAgentBrief): Promise<AtlasRepoAgentResult>;
};
```

Provider adapters can use OpenAI, a gateway, or another LLM.
Agent backends can use Codex or another repo-aware agent.

The provider should be able to produce a proposal without write authority.
The agent backend can prepare actual patches, run validation, and open a PR.

### 6. Proposal Model

The durable operation should emit an `AtlasShapeProposal`.

Minimum proposal fields:

1. trigger and commit range,
2. summary,
3. affected atlas items,
4. candidate new shapes,
5. candidate relation changes,
6. semantic signals to add,
7. evidence and citations,
8. markdown patches,
9. uncertainty and open questions,
10. suggested review path.

Every claim should be grounded in a file, plan, diff, PR, test, story, or explicit inference label.

### 7. Review And Versioning

V0 should be PR-first.

The easy, safe path:

1. create a branch,
2. apply proposed markdown changes,
3. open a PR,
4. let GitHub and the Atlas UI show the proposal.

The richer future path:

1. Atlas has proposal runs as first-class objects,
2. each run can expose a branch preview of the atlas graph,
3. accepted proposals become atlas versions,
4. rejected proposals remain historical evidence of interpretation.

Git can be the underlying version store for now.

## Execution Slices

1. Define the `AtlasShapeRun` and `AtlasShapeProposal` source shape in markdown or TypeScript.
2. Add an Atlas shape for the Shaping experience.
3. Build a manual command or server action that runs re-shaping for one selected atlas shape.
4. Implement `reconstruct-shape-evolution` first, because it matches the current pain around `Domain Operation`.
5. Produce a proposal markdown file or PR-ready patch, but do not apply automatically.
6. Keep GitHub push automation as the next integration once the proposal shape feels useful.

## Non-Goals

1. Do not let the LLM silently mutate atlas source.
2. Do not require perfect confidence scores.
3. Do not replace human semantic judgment.
4. Do not solve multi-user live editing yet.
5. Do not require a long-lived server-authoritative atlas database in v0.

## Open Questions

1. Should the first automated trigger be push, PR merge, or manual `Ask Atlas to re-shape this branch`?
2. Should proposals live as files under `atlas/proposals/`, as durable operation records, or only as PR descriptions?
3. How much code access is needed before a proposal can claim implementation evidence?
4. When does a direct LLM provider stop being enough and require a Codex-style agent?
5. How do we distinguish "future idea", "stale historical plan", and "current model drift" in the proposal UI?
6. Can branch previews be rendered by pointing the Atlas parser at a checkout, or do we need stored atlas snapshots?

## Verification

1. The Atlas has a named Shaping experience.
2. The plan defines a v0 architecture from change intake to durable run to proposal review.
3. The first interpretive skill is explicitly scoped to reconstructing an item's evolution.
4. The proposal flow is reviewable and git-friendly.
5. Push automation is described without making it a prerequisite for the first useful slice.

## Closure / Evolution

Not closed. This plan should stay idea-level until one manual shaping run exists. Once that works, the plan can split into concrete child work for proposal storage, repo access, interpretation skills, and GitHub push or PR triggers.
