# AGENTS Instructions for `atlas`

When working in this repository:

1. Read `docs/plan-execution-workflow.md` when creating, executing, moving, or closing plans.
2. Use `atlas/items/spec-workstream-atlas/atlas-model/plan/outline-v0.md` as the authoring lens for
   substantial plans.
3. Keep Atlas-owned product and implementation work under `plans/` and durable system form under
   `atlas/items/spec-workstream-atlas/`.
4. Use canonical source URIs such as `bookops://...` and `ontahi://...` for cross-repository
   relationships; use ordinary repository-relative paths for Atlas-owned references.
5. Update the relevant plan checkpoint and smallest durable Atlas item before opening or updating a
   PR that changes system shape.
6. Run `pnpm verify` for application changes. For Markdown-only ownership or reference changes, run
   the focused source/snapshot tests plus `git diff --check` at minimum.
7. Read `docs/atlas-evidence-binding-guidelines.md` before preparing commits or PRs. Put supported
   Atlas directives in the PR body when the work implements or shapes a registered target; commit
   trailers alone do not create evidence.
8. When work is handed off with an Atlas Session instruction, preserve its exact
   `Atlas-Session: <uuid>` line once in every PR body for that work, including later PR edits.
   Never invent or infer a Session ID; omit the directive when no exact ID was provided.

Do not copy external project plans or item trees into Atlas. Federation should preserve the source
repository as authority.
