# 140. Workspace Sources And Contributor Discovery

Status: current

Definition level: shaping

## Summary

Turn Workspace Settings into the first useful adoption surface by making repository Sources visible
and deriving contributor candidates from evidence Atlas already observes. Keep observed participation
separate from authorized Membership: a person may contribute to a Source, Plan, or Item without an
Atlas account or permission to enter its Workspace.

This slice also records the broader model pressure behind the UI. Contributors are one projection of
participation over evidence. The first implementation derives participants for a Workspace Source;
later projections may answer who participated in an Item or Plan from file history, shaped-by Plans,
Pull Requests, reviews, or other attributable evidence.

## Context

Workspace Ownership V0 and Workspace Members Settings established one durable ownership boundary and
a policy-scoped read-only settings page. The page can show active Memberships, but it cannot explain
which repositories belong to the Workspace, whether they are synchronized, or which people Atlas has
observed around that work.

Atlas currently loads desired Source definitions from repository YAML or environment configuration.
Observed `AtlasSourceRevision` and `AtlasSourceRecord` rows describe what was ingested; they are not
the Workspace-owned registration that says what should be ingested. GitHub Pull Request evidence
already carries provider account, login, and avatar information that can support a first contributor
projection without treating Git author email as identity.

Related work:

1. [`Atlas Adoption Foundation`](./136-atlas-adoption-foundation.md)
2. [`Workspace Ownership V0`](../done/137-workspace-ownership-v0.md)
3. [`Workspace Members Settings`](../done/139-workspace-members-settings.md)
4. [`Workspace`](../../atlas/items/spec-workstream-atlas/access-and-identity/workspace.md)
5. [`Participation`](../../atlas/items/spec-workstream-atlas/atlas-model/participation.md)

## Research / Evidence

1. A commit author name or email is evidence of authorship, not a proven Atlas or GitHub identity.
2. A GitHub actor ID is stable provider identity, but becomes an Atlas User only after an explicit
   account link proves control.
3. Bots, shared accounts, rebases, co-authors, reviews, and shaped-by relations mean participation is
   richer than a distinct list of commit authors.
4. Source registration is desired Workspace configuration. Source revisions and records remain
   observed projection state and must not be overloaded as configuration.
5. The existing settings page already uses Ontahi Graph Queries and receiver-derived Workspace
   authority. Sources and contributors should use the same Runtime Protocol rather than custom HTTP
   routes.

## Scope

1. Define a Workspace-owned Source registration independently from observed revisions and records.
2. Show registered Sources, provider/repository identity, synchronization state, and contributor
   admission policy in Workspace Settings.
3. Derive contributor candidates from attributable GitHub evidence for registered Sources.
4. Present Members and observed Contributors as different populations.
5. Define the transition from an observed provider identity to an invitation or approved Membership.
6. Preserve enough provenance to explain why Atlas considers someone a participant.

## Non-Goals

1. Do not infer Membership merely from commit authorship, Pull Request activity, or repository access.
2. Do not grant `owner` or `collaborator` automatically.
3. Do not build generic provider plugin infrastructure before a second provider requires it.
4. Do not implement Item- or Plan-level participant avatars in the first Source slice.
5. Do not require a full repository-history import before the first GitHub evidence projection is
   useful.
6. Do not expose provider tokens or installation credentials through Graph Queries.

## Proposed Form

### Product model

```text
Workspace
  |-- SourceRegistration(provider, repository, ref, sync state, admission policy)
  |     `-- observed evidence -> ContributorCandidate(provider account, participation summary)
  |                                  `-- invite / approve -> Membership(User, role)
  `-- Membership(User, role, status)
```

`ContributorCandidate` is a projection, not a manually curated identity record. It may reference a
linked Atlas User when the provider account is proven, but it remains useful when no Atlas account
exists yet.

The initial admission policies are:

1. `off`: observed contributors receive no access affordance;
2. `approval-required`: owners can review and approve or invite candidates; this is the default;
3. `automatic-viewer`: a contributor with a proven linked provider account may receive an auditable
   viewer Membership; unlinked contributors remain candidates.

### Settings interaction

```text
General

Sources
  Connected repositories
    provider / repository / ref
    sync state / last observation
    contributor admission policy
  Add repository

People
  Members
  Invitations
  Contributors observed from Sources
    linked / unlinked / bot
    evidence summary
    invite / approve / ignore
```

The first UI may keep registration and admission mutations disabled until their Operations land, but
it must render real registrations and observed evidence rather than static examples.

### Participation projection

The Source contributor list is the first scope of a reusable participation question:

```text
participants(scope, evidence policy) -> attributed actors + explanation
```

Future scopes may be an Item, Plan, Source, Workspace, or selected subgraph. Evidence policies may
include file modifications, explicit PR bindings, shaped-by Plans, reviews, sessions, or authored
artifacts. Atlas should preserve the evidence path so a face or name can explain why it appears.

## Execution Slices

### Slice 1 — source registration read model

- [x] Add a Workspace-owned Source registration entity and PostgreSQL migration.
- [x] Seed the existing configured Sources into the default Workspace without replacing YAML as the
      bootstrap authority yet.
- [x] Add Workspace-scoped Graph Read policy and client Query.
- [x] Render a Sources section with repository identity, status, and admission policy.

### Slice 2 — contributor discovery projection

- [x] Define provider-neutral contributor identity and participation summary fields.
- [x] Derive GitHub candidates from observed Pull Requests for registered repositories.
- [x] Deduplicate by provider plus stable provider account ID; treat login as presentation data.
- [x] Keep bots and unlinked accounts visible and labelled rather than silently granting access.
- [x] Render Contributors separately from Members with evidence explanations.

### Slice 3 — reviewed connection and admission

- [x] Add an owner-authorized Source registration Operation over the Ontahi bridge.
- [x] Select repositories from the authenticated User's authorized GitHub repository list.
- [ ] Add invitation/approval Operations and lifecycle state.
- [ ] Implement `automatic-viewer` only for proven linked provider accounts with auditable provenance.

### Slice 4 — Source activation and cancellation boundary

- [ ] Turn a registered Source into a Workspace-partitioned reconciliation run with observable
      pending, running, completed, failed, and cancelled states.
- [ ] Let an owner cancel an in-flight Source import and explicitly clean up partial derived state.
- [ ] Keep Source registration, imported projection state, and reconciliation execution records as
      separate lifecycle concepts.
- [ ] Require the first implementation to declare manual cancellation and compensation behavior;
      do not depend on automatic reversal of arbitrary effects.

## Verification

- [x] A member reads only Source registrations belonging to their authorized Workspace.
- [ ] Observed revisions cannot implicitly create or mutate desired registrations.
- [x] Contributor discovery never creates Membership on its own.
- [x] Provider account ID, not email or mutable login, drives contributor identity.
- [x] Every contributor row can explain at least one evidence path.
- [ ] Settings covers loading, empty, failure, populated, linked, unlinked, and bot states.
- [x] Graph Reads and Operations use the shared Runtime Protocol without custom settings routes.
- [ ] PostgreSQL integration tests prove cross-Workspace Source and contributor isolation.
- [x] `pnpm verify` passes.

## Decisions

1. Source registration precedes invitation UX because it establishes which observed contributors are
   relevant to a Workspace.
2. Participation and authorization are distinct: evidence can nominate a person but cannot admit
   them.
3. `approval-required` is the default policy; automatic admission is limited to `viewer` and requires
   a linked provider account.
4. Contributor discovery is the first implementation of a broader evidence-derived Participation
   projection.
5. Desired Source configuration and observed Source state remain separate durable forms.

## Open Questions

1. Should one Source registration belong to exactly one Workspace, or should a provider binding be
   mountable into several Workspaces through grants?
2. Is `automatic-viewer` best represented by a reconciled Membership with origin metadata or by a
   separate effective grant?
3. Which GitHub activities count in V0: merged Pull Requests only, commits, reviews, or all three?
4. How should contributor removal behave when participation disappears from a rolling observation
   window but historical evidence remains?
5. Should Item/Plan participation be materialized or computed from evidence when requested?
6. When an owner removes a Source while reconciliation is running, should removal first request
   cancellation and wait for compensation, or mark the registration as retiring until cleanup
   converges asynchronously?

## Closure / Evolution

Not closed. The first checkpoint is a read-only Source registration surface backed by a durable
Workspace-owned model. Contributor discovery follows on the same evidence boundary before invitation
or role mutations.

### 2026-11-01 — Source registration read model

Atlas now declares `AtlasWorkspaceSource` separately from observed revisions, persists registrations
in `atlas_workspace_sources`, seeds the current default Workspace Sources, and exposes them through a
Workspace-scoped Graph Query. Settings renders real registrations, synchronization enablement, ref,
and contributor admission policy. `Add repository` remains visibly unavailable until an authorized
Operation and GitHub installation repository selector make the action real.

### 2026-11-01 — contributor discovery projection

`AtlasWorkspaceContributor` now materializes participation from observed merged Pull Requests for
registered Sources. The projection deduplicates on stable GitHub account ID, retains current login
and avatar as presentation evidence, summarizes count and latest participation, labels bots, and
links to an Atlas User only through a proven GitHub `AtlasAuthAccount`. Reconciliation replaces the
projection only for successfully observed evidence Sources, preserving prior participants when a
provider observation is degraded.

Workspace Settings renders contributor avatars and explanations separately from Membership. No
contributor row grants access or creates a Membership.

Production Graph Reads exposed a PostgreSQL portability mismatch: `timestamptz` values arrive from
`pg` as JavaScript `Date` objects, while Atlas datetime fields and the Runtime Protocol are portable
ISO strings. Atlas now normalizes PostgreSQL result rows, including transaction clients, before they
enter the Data Graph. This keeps the durable timestamp column and prevents settings responses from
being rejected as non-portable without weakening the protocol boundary.

The settings projection now collapses Source-scoped participation into people. Contributor rows
linked to a Workspace Member enrich that Member with one GitHub identity and an aggregate of the
Sources where they participated; only unlinked identities remain in the contributor-review list.
The unavailable repository mutation is presented as upcoming capability rather than as a disabled
action, pending the owner-authorized registration Operation and GitHub installation selector.

Source cards display the provider, repository, and ref without repeating Atlas's internal
`sourceId`; GitHub repositories link to their provider page. Contributor handles link to their
provider profile. The review population is defined by
missing Workspace access rather than missing Atlas identity: a linked Atlas User without Membership
still remains visible as an admission candidate, while a linked Member is folded into the Member
row.

### 2026-11-03 — first repository connection

Workspace owners can now register a GitHub repository through a typed bridge Operation. Atlas
validates that GitHub can read `owner/repository`, adopts its canonical full name and default branch,
rejects duplicate Workspace registrations, and persists the Source with approval-required
contributor admission. The empty Workspace embeds this connection step directly instead of
diverting first-time setup through the full Settings surface.

Repository choice is not free text. Atlas requests delegated repository access incrementally,
stores the resulting OAuth credential encrypted, and lists only repositories returned by GitHub for
the authenticated User. The picker is searchable and registration rejects a forged repository that
was not part of that authorized list. A later GitHub App installation picker may narrow provider
access further, but it is no longer a prerequisite for a coherent first user-scoped flow.

Owner affordances use the server-resolved Workspace Membership from the route boundary. They do not
depend on the client Graph View successfully joining the Membership to a presentation profile; in
local memory mode that profile may be absent even though the creator's owner Membership exists.

Repository selection also exposes the next execution boundary. Registration alone is immediate;
future activation may start a durable reconciliation that fetches, parses, derives, and publishes a
Workspace projection. Deselecting or removing a Source during that work must therefore mean more
than deleting configuration: Atlas needs an explicit cancellation request and deterministic cleanup
of partial derived state. The first safe form is manual compensation declared by the reconciliation
operation, with idempotent checkpoints and an execution journal. Automatic inversion of Ontahi
mutations or external effects is a later runtime direction, not a prerequisite for Source import.
