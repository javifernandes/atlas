# 159. Workspace Invitations End To End

Status: current

## Summary

Implement the first end-to-end Workspace invitation path using the Entity, Operation, and
Interaction contracts already shaped in Atlas. A Workspace Owner can invite a person discovered
through repository participation, the addressed Atlas User can prove that the invitation belongs
to them, and that User can accept or decline it. Acceptance creates or activates exactly one
Workspace Membership with the offered role.

This plan turns the invitation model into product behavior without broadening the first slice into
a general identity, email-delivery, notification, or authorization framework. Its main purpose is
to close the gap between the Interaction activity graphs and the Ontahí Operations, persisted
Entities, Graph Queries, and React surfaces that realize them.

## Context

Atlas currently distinguishes explicit Workspace Membership from repository participation.
Workspace Settings shows Members and discovered Contributors, including stable GitHub account
identity and an optional linked Atlas User, but an owner cannot turn that evidence into a consented
Membership. Adding the contributor directly would bypass the recipient's choice; asking owners to
coordinate access outside Atlas would leave the product flow incomplete.

Plan 149 established the durable product form before implementation:

1. [[spec-workstream-atlas.access-identity.workspace.invitation|Workspace Invitation]] owns the
   offer and its lifecycle.
2. [[spec-workstream-atlas.access-identity.workspace.invitation.invite|Invite]],
   [[spec-workstream-atlas.access-identity.workspace.invitation.claim|Claim]],
   [[spec-workstream-atlas.access-identity.workspace.invitation.accept|Accept]], and
   [[spec-workstream-atlas.access-identity.workspace.invitation.decline|Decline]] own the mutating
   behavior.
3. [[spec-workstream-atlas.access-identity.workspace.invite-person-to-workspace|Invite Person To
   Workspace]] and
   [[spec-workstream-atlas.access-identity.workspace.respond-to-invitation|Respond To Workspace
   Invitation]] preserve the actor-facing flows.

The first implementation must remain compatible with Atlas's current local Workspace role checks.
It should produce evidence for a later Ontahí authorization primitive rather than making that
framework work a prerequisite.

## Research / Evidence

1. `AtlasWorkspaceMembership` already records Workspace, User, role, and active/suspended status.
2. `AtlasWorkspaceContributor` already preserves `providerAccountId`, mutable display login, and
   `linkedUserId`. The stable provider account ID is suitable addressing evidence; login and email
   are not identity proof.
3. `AtlasAuthAccount` links an authenticated User to a stable issuer/provider account ID. It can
   prove a provider-addressed invitation without silently merging Users.
4. Workspace creation already creates its owner Membership transactionally. Invitation acceptance
   needs the same atomicity discipline across invitation state and Membership creation.
5. Private invitation reads cannot depend only on existing Workspace Membership: the intended
   recipient must read and claim their own invitation before becoming a member.
6. The current contributor-review collection excludes Users who already have active Membership.
   The invitation affordance belongs on the remaining discovered contributor rows.

## Scope

1. Persist Workspace Invitations with their recipient address, claim policy, proposed role,
   lifecycle state, expiry, inviter, claimant, and resulting Membership.
2. Support recipient addressing by an existing Atlas `UserId` or stable GitHub provider account
   identity.
3. Let an owner invite a discovered contributor as `collaborator` or `viewer`.
4. Surface pending invitation state in Workspace administration instead of allowing duplicate
   invitations.
5. Let an authenticated recipient discover, claim, accept, or decline compatible invitations.
6. Create or activate Membership atomically and idempotently when the recipient accepts.
7. Let a Workspace Owner revoke a Pending or Claimed invitation.
8. Enforce expiry at every claim or response boundary and represent an elapsed invitation as
   unavailable even before scheduled expiry processing exists.
9. Preserve exact role, identity, and invitation boundaries through Graph Read policies and
   Operation authorization.

## Non-Goals

1. Arbitrary email invitations, outbound email delivery, or signed email secrets.
2. SMS, push, or a general notification-delivery subsystem.
3. Automatic account merging based on matching email, login, or profile data.
4. Google or additional identity-provider support beyond the existing stable account model.
5. Ownership transfer, owner invitations, or role administration after Membership exists.
6. A generic Ontahí authorization primitive.
7. Scheduled expiry workers. The first slice enforces expiry synchronously and may reconcile the
   stored state lazily.
8. Executing the Interaction graph itself as a workflow. Operations and durable Entity state remain
   runtime authority.

## Proposed Form

### Persisted invitation

The first storage shape specializes the broader durable Entity to the two supported recipient
forms:

```text
AtlasWorkspaceInvitation
  id
  workspaceId
  invitedByUserId
  recipientKind             user | github
  recipientUserId           nullable
  recipientProvider         nullable; github in this slice
  recipientProviderAccountId nullable
  claimPolicy               known-user | provider-identity
  proposedRole              collaborator | viewer
  status                    pending | claimed | accepted | declined | revoked | expired
  claimedByUserId           nullable
  membershipId              nullable
  expiresAt
  createdAt
  updatedAt
```

Exactly one recipient representation applies. The schema and Operations validate compatible pairs:
`user` with `known-user`, or `github` with `provider-identity`. Mutable GitHub login remains display
data and never participates in proof.

Indexes should support:

1. invitations by Workspace and status for owner administration;
2. invitations by recipient User and active status;
3. invitations by provider plus provider account ID and active status;
4. conflict detection for equivalent Pending or Claimed invitations.

### Operation boundaries

`AtlasWorkspace.invite`:

1. requires an active owner Membership;
2. resolves the selected contributor to a linked User or stable GitHub identity;
3. refuses existing access and equivalent active invitations;
4. creates one Pending invitation with a bounded expiry;
5. does not create Membership.

`AtlasWorkspaceInvitation.claim`:

1. requires a Pending, unexpired invitation;
2. proves the current User exactly matches `recipientUserId`, or owns an `AtlasAuthAccount` whose
   stable provider account ID matches the GitHub address;
3. binds `claimedByUserId` once and transitions to Claimed;
4. never links or merges accounts as a side effect.

`AtlasWorkspaceInvitation.accept` and `.decline` require the current User to be the claimant.
Accept runs in one transaction that rechecks invitation state, creates or activates at most one
Membership for `(workspaceId, userId)`, stores its ID on the invitation, and transitions to
Accepted. Decline transitions to Declined without creating access.

`AtlasWorkspaceInvitation.revoke` requires an active Workspace owner and transitions Pending or
Claimed to Revoked. Expiry is checked by claim, accept, decline, revoke, and recipient reads; an
elapsed active invitation is unavailable even if its stored status has not yet been reconciled to
Expired.

### Read and security model

Workspace owners may list and inspect invitations for their Workspace. A recipient may read an
invitation only when one of these is true:

1. its `recipientUserId` equals the current User;
2. one of the current User's stable auth accounts exactly matches its provider address;
3. its `claimedByUserId` equals the current User.

Contributor and invitation projections expose only the addressing and lifecycle data needed by the
current actor. No mutation trusts role, Workspace, recipient, or claimant values supplied only by
the client.

### Product flow

In Workspace Settings, an owner opens a discovered contributor, chooses `collaborator` or `viewer`,
and invokes Invite. A linked contributor produces a known-User invitation; an unlinked GitHub
contributor produces a provider-identity invitation. The row then shows Pending or Claimed status
and no longer offers a duplicate Invite action.

After authentication, Atlas lists compatible outstanding invitations on the user's Workspace home
experience. Opening one realizes `Respond To Workspace Invitation`: the user sees the inviting
Workspace, inviter, offered role, expiry, and identity path; Atlas claims it when required; the user
accepts or declines. Acceptance navigates to the newly accessible Workspace. Decline confirms that
no access was created.

The first slice uses an in-product outstanding-invitations section instead of inventing a general
notification system. A later delivery mechanism may deep-link into the same response Interaction.

### Rollout and compatibility

The new table requires no data backfill. Existing Memberships remain authoritative and prevent new
equivalent invitations. Existing contributor discovery continues unchanged. The feature should be
introduced behind UI availability derived from the registered Operations, so incomplete deployment
of one surface does not expose a dead affordance.

## Execution Slices

### Slice 0 — contract checkpoint

- [x] Bound the first recipient forms to linked Atlas Users and stable GitHub identities.
- [x] Keep email delivery and generic authorization outside the first end-to-end slice.
- [x] Confirm the first-slice field and failure names against the existing Workspace domain
      conventions.
- [ ] Add standalone durable Revoke and Expire Operation Items before their implementation changes
      system shape.

### Slice 1 — Entity and persistence

- [x] Add `AtlasWorkspaceInvitation` to the Workspace domain model.
- [x] Add Postgres mapping, migration, indexes, and portable field types.
- [ ] Add Graph Views and owner/recipient-aware read policy coverage.
- [x] Add the owner administration View and restrict it to the active Workspace owner.
- [x] Verify that a non-owner cannot discover invitations through the administration View.

### Slice 2 — owner invitation path

- [x] Implement `AtlasWorkspace.invite` with owner authorization and typed failures.
- [x] Resolve contributor addressing without trusting mutable login.
- [x] Add role selection and Invite affordance to contributor review.
- [x] Replace the affordance with Pending or Claimed lifecycle feedback after success.
- [x] Prevent an existing Membership or equivalent active invitation.
- [x] Add a reversible, local-only unlinked contributor fixture for repeatable owner-path testing.

### Slice 3 — recipient discovery and claim

- [ ] Query outstanding invitations compatible with the current User and linked auth accounts.
- [ ] Add the outstanding-invitations entry point to the authenticated home experience.
- [x] Implement `AtlasWorkspaceInvitation.claim` with exact known-User/provider proof.
- [x] Preserve the intended invitation through authentication and return navigation, including an
      explicit account-switch path that does not disclose invitation context to an incompatible
      identity.

### Slice 4 — response and Membership creation

- [ ] Implement accept and decline Operations.
- [ ] Make accept atomically create or activate one Membership and finalize the invitation.
- [ ] Make retry after a committed accept return the same effective Membership outcome.
- [ ] Realize the response Interaction with role, Workspace, inviter, expiry, and claim-state
      feedback.
- [ ] Navigate an accepted recipient into the Workspace without requiring another login.

### Slice 5 — owner management and expiry

- [ ] Implement and expose Revoke for Pending and Claimed invitations.
- [ ] Show invitation history and terminal states in Workspace administration.
- [ ] Enforce expiry across read and mutation boundaries.
- [ ] Record whether scheduled expiry deserves an Ontahí durable/background primitive follow-up.

### Slice 6 — rollout and evidence

- [x] Extract the invitation response presentation from its Ontahí Operation container so product
      states can be inspected without executing authentication or domain mutations.
- [x] Add Storybook realizations for the invitation response states and bind them through stable
      Atlas metadata rather than copied Storybook URLs.
- [x] Prove the Storybook binding contract on Invitations with concrete story-to-activity examples
      before applying it to other Interactions.
- [x] Surface registered Storybook evidence from the Interaction through an embedded preview and
      current Storybook deep link when Storybook is configured. Development may fall back to
      `http://localhost:6006`; production uses only `NEXT_PUBLIC_ATLAS_STORYBOOK_URL`. Without that
      variable, keep the semantic binding visible without rendering an iframe or broken link.
- [ ] Exercise linked-User and unlinked-GitHub contributor paths end to end.
- [ ] Verify authorization and race behavior against two browser identities.
- [ ] Update the Interaction and Operation realization references that actually landed.
- [ ] Record PR implementation evidence against this Plan and shaped durable Items.

## Verification

1. An owner can invite one discovered contributor as collaborator or viewer.
2. A non-owner cannot create, revoke, inspect, or enumerate Workspace invitations.
3. A linked recipient sees only invitations addressed to their exact User.
4. A GitHub-addressed recipient proves the exact stable provider account ID, not login or email.
5. An unrelated User cannot read, claim, accept, or decline the invitation.
6. Accept creates or activates exactly one Membership despite retries or concurrent responses.
7. Decline, revoke, and expiry never create Membership.
8. Terminal invitations cannot transition again.
9. Settings distinguishes contributor evidence, invitation lifecycle, and active Membership.
10. Existing Workspace creation, source reconciliation, contributor discovery, and visibility
    behavior remain unchanged.
11. Domain, policy, persistence, Operation, and UI tests cover both supported recipient forms.
12. `pnpm verify` passes before the application PR is proposed.

## Decisions

1. Consent is explicit: contributor evidence can address an invitation but never creates access.
2. The stable provider account ID is proof material; GitHub login and email are presentation data.
3. Atlas-local role checks remain the first implementation boundary.
4. Claim is explicit domain behavior even when the UI can perform it immediately after opening an
   invitation.
5. Membership creation and invitation acceptance form one atomic transaction.
6. Outstanding invitations are initially an authenticated product section, not a general-purpose
   notification primitive.
7. Expiry correctness does not wait for a scheduler; scheduled reconciliation is an optimization.
8. The Interaction graph describes and tests product intent, while Ontahí Operations and Entity
   state remain executable authority.

## Open Questions

1. Should inviting an already Pending recipient return the existing invitation or preserve the
   current typed `EquivalentInvitationExists` failure? The first implementation should choose one
   behavior and keep retries separately idempotent.
2. Should an owner be able to change the proposed role on a Pending invitation, or revoke and
   create another one?
3. Where should the outstanding-invitations entry point live once Atlas has a general activity or
   notification surface?
4. Does lazily persisting `Expired` during a read violate the desired Graph Query purity, requiring
   a small reconciliation Operation instead?
5. Which runtime trace identifiers should eventually bind Operation execution back to the stable
   Interaction activity nodes?

## Closure / Evolution

The closing slice includes persisted Workspace Invitations, the owner invite path and contributor
fixture, claim across authentication return and account switching, Interaction and state diagrams,
and the optional Storybook evidence lens. Storybook is inspectable implementation evidence, not a
dependency of the invitation runtime flow.

Explicitly deferred from this cut are accept or decline atomically creating Membership,
outstanding invitations on the authenticated home surface, and revoke, expiry, and complete
invitation history. These remain unchecked above and should be resumed as focused follow-up work.
