---
id: spec-workstream-atlas.access-identity.workspace.respond-to-invitation
kind: interaction
title: Respond To Workspace Invitation
parent: spec-workstream-atlas.access-identity.workspace.manage-contributors
scope:
  entity: AtlasWorkspaceInvitation
  binding: invitation
status: shaping
horizon: now
typeOf:
  - spec-workstream-atlas.atlas-model.interaction
relatedPlans:
  - plans/current/149-interaction-model-v0.md
  - plans/current/159-workspace-invitations-end-to-end.md
  - plans/current/140-workspace-sources-and-contributor-discovery.md
  - plans/current/142-workspace-administration-settings.md
---

## Goal

Let the intended recipient understand and deliberately accept or decline a Workspace invitation
after proving the identity required by its addressing path.

## Activity

```atlas-activity
activity:
  entry: open-invitation
  actors:
    invitation-recipient:
      label: Invitation Recipient
      description: The person proving control of the invitation's addressed identity and choosing its response.
      context:
        - ref: spec-workstream-atlas.access-identity.workspace.invitation
          label: Workspace invitation addressee
  nodes:
    open-invitation:
      kind: stimulus
      label: Open invitation URL
      actor: invitation-recipient
      responsibility: external
    resolve-context:
      kind: activity
      label: Resolve invitation context
      responsibility: system
      reads:
        - ref: spec-workstream-atlas.access-identity.workspace.invitation
          label: Workspace invitation
        - ref: spec-workstream-atlas.access-identity.workspace
          label: Workspace
        - ref: spec-workstream-atlas.access-identity.workspace.membership
          label: Membership
      presents:
        - ref: spec-workstream-atlas.access-identity.workspace.invitation
          label: Invitation intent and lifecycle
    lifecycle-allows-response:
      kind: decision
      label: Invitation allows response?
      responsibility: system
      reads:
        - ref: spec-workstream-atlas.access-identity.workspace.invitation
          label: Invitation lifecycle
    invitation-unavailable:
      kind: outcome
      label: Invitation unavailable
    actor-authenticated:
      kind: decision
      label: Actor is authenticated?
      responsibility: system
      reads:
        - ref: spec-workstream-atlas.access-identity.user
          label: Current User
    authenticate:
      kind: activity
      label: Sign in or switch account
      actor: invitation-recipient
      responsibility: actor
    addressing-policy:
      kind: decision
      label: Which addressing policy applies?
      responsibility: system
      reads:
        - ref: spec-workstream-atlas.access-identity.workspace.invitation
          label: Invitation addressing policy
    user-id-matches:
      kind: decision
      label: Authenticated User matches target?
      responsibility: system
      reads:
        - ref: spec-workstream-atlas.access-identity.user
          label: Current User
    prove-github-identity:
      kind: activity
      label: Prove GitHub identity
      actor: invitation-recipient
      responsibility: actor
    provider-id-matches:
      kind: decision
      label: Provider identity matches target?
      responsibility: system
      reads:
        - ref: spec-workstream-atlas.access-identity.external-identity
          label: External Identity
    prove-invitation-secret:
      kind: activity
      label: Prove invitation secret
      actor: invitation-recipient
      responsibility: actor
    invitation-secret-valid:
      kind: decision
      label: Invitation secret is valid?
      responsibility: system
      reads:
        - ref: spec-workstream-atlas.access-identity.workspace.invitation
          label: Invitation claim policy
    identity-proof-refused:
      kind: outcome
      label: Identity proof refused
    eligible-recipient:
      kind: merge
      label: Recipient identity proven
    claim-invitation:
      kind: operation
      label: Claim Workspace Invitation
      ref:
        ref: spec-workstream-atlas.access-identity.workspace.invitation.claim
        label: Claim Workspace Invitation
    choose-response:
      kind: decision
      label: Accept or decline invitation?
      actor: invitation-recipient
      responsibility: actor
    accept-invitation:
      kind: operation
      label: Accept Workspace Invitation
      ref:
        ref: spec-workstream-atlas.access-identity.workspace.invitation.accept
        label: Accept Workspace Invitation
    decline-invitation:
      kind: operation
      label: Decline Workspace Invitation
      ref:
        ref: spec-workstream-atlas.access-identity.workspace.invitation.decline
        label: Decline Workspace Invitation
    invitation-accepted:
      kind: outcome
      label: Invitation accepted
    invitation-declined:
      kind: outcome
      label: Invitation declined
    response-abandoned:
      kind: outcome
      label: Response abandoned
  transitions:
    - id: invitation-opened
      from: open-invitation
      to: resolve-context
      trigger: invitation URL opened
    - id: context-resolved
      from: resolve-context
      to: lifecycle-allows-response
    - id: invitation-unavailable
      from: lifecycle-allows-response
      to: invitation-unavailable
      branch: "No"
      guard: invitation is missing, expired, revoked, or no longer pending
    - id: invitation-claimable
      from: lifecycle-allows-response
      to: actor-authenticated
      branch: "Yes"
      guard: invitation is pending and claimable
    - id: authentication-required
      from: actor-authenticated
      to: authenticate
      branch: "No"
      guard: no authenticated Atlas User
      affordance: Sign in
    - id: authentication-changed
      from: authenticate
      to: actor-authenticated
      result: authentication state changed
    - id: actor-authenticated
      from: actor-authenticated
      to: addressing-policy
      branch: "Yes"
      guard: an Atlas User is authenticated
    - id: known-user-policy
      from: addressing-policy
      to: user-id-matches
      guard: invitation targets a known Atlas User
    - id: known-user-proven
      from: user-id-matches
      to: eligible-recipient
      branch: "Yes"
      guard: authenticated User ID equals target User ID
    - id: known-user-mismatch
      from: user-id-matches
      to: authenticate
      branch: "No"
      guard: authenticated User ID differs from target User ID
      affordance: Switch account
    - id: github-identity-policy
      from: addressing-policy
      to: prove-github-identity
      guard: invitation targets an observed GitHub identity
      affordance: Continue with GitHub
    - id: github-identity-available
      from: prove-github-identity
      to: provider-id-matches
      result: provider identity is available
    - id: github-identity-proven
      from: provider-id-matches
      to: eligible-recipient
      branch: "Yes"
      guard: provider and stable account ID equal the invitation target
    - id: github-identity-refused
      from: provider-id-matches
      to: identity-proof-refused
      branch: "No"
      guard: provider identity does not equal the invitation target
    - id: verified-email-policy
      from: addressing-policy
      to: prove-invitation-secret
      guard: invitation uses a verified-email secret
      affordance: Continue with invitation link
    - id: invitation-secret-available
      from: prove-invitation-secret
      to: invitation-secret-valid
      result: signed invitation secret is available
    - id: invitation-secret-proven
      from: invitation-secret-valid
      to: eligible-recipient
      branch: "Yes"
      guard: secret is valid for this pending invitation
    - id: invitation-secret-refused
      from: invitation-secret-valid
      to: identity-proof-refused
      branch: "No"
      guard: secret is missing, invalid, or belongs to another invitation
    - id: recipient-eligible-to-claim
      from: eligible-recipient
      to: claim-invitation
    - id: invitation-claimed
      from: claim-invitation
      to: choose-response
      result: invitation is claimed by the current User
    - id: invitation-accept-selected
      from: choose-response
      to: accept-invitation
      affordance: Accept invitation
    - id: invitation-decline-selected
      from: choose-response
      to: decline-invitation
      affordance: Decline invitation
    - id: invitation-response-deferred
      from: choose-response
      to: response-abandoned
      affordance: Respond later
    - id: invitation-accepted
      from: accept-invitation
      to: invitation-accepted
      result: active Membership exists with the invited role
    - id: invitation-declined
      from: decline-invitation
      to: invitation-declined
      result: invitation is closed without Membership
```

## Actors

| Actor                | Participation                                                |
| -------------------- | ------------------------------------------------------------ |
| Invitation Recipient | Proves control, claims the invitation, and chooses a response |

## Context

| Requirement                                                      |
| ---------------------------------------------------------------- |
| A pending Workspace invitation can be located                    |
| The invitation has not expired or been revoked                   |
| An authenticated Atlas User exists or sign-in is available       |
| Claiming the invitation has not yet granted Workspace Membership |
| A known-User claim requires the same authenticated User ID       |
| A GitHub claim requires the linked stable provider account ID    |
| An email claim requires the invitation secret, not account matching |

## Presents

| Information               | Source                                                       | Step                         |
| ------------------------- | ------------------------------------------------------------ | ---------------------------- |
| Inviting Workspace        | Workspace invitation                                         | Inspect invitation           |
| Inviting owner            | invitation provenance and active owner Membership            | Inspect invitation           |
| Proposed role             | Workspace invitation intent                                  | Inspect invitation           |
| Expiry and current status | Workspace invitation lifecycle                               | Inspect invitation           |
| Addressing path           | known User, observed provider identity, or verified email    | Known User identity          |
| Required identity proof   | claim policy selected when the invitation was created        | Known User identity          |
| Current claim state       | unclaimed, claimed by current User, or incompatible claimant | Accept or decline invitation |

## Affordances

| Affordance                | Kind     | Target                                                                                               | Step                         |
| ------------------------- | -------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| Sign in or switch account | stimulus | authentication ingress                                                                               | Known User identity          |
| Prove GitHub identity     | stimulus | account-linking ingress                                                                               | GitHub identity              |
| Prove invitation secret   | stimulus | invitation-secret ingress                                                                             | Verified email               |
| Claim invitation          | invokes  | [[spec-workstream-atlas.access-identity.workspace.invitation.claim\|Claim Workspace Invitation]]     | Accept or decline invitation |
| Accept invitation         | invokes  | [[spec-workstream-atlas.access-identity.workspace.invitation.accept\|Accept Workspace Invitation]]   | Accept or decline invitation |
| Decline invitation        | invokes  | [[spec-workstream-atlas.access-identity.workspace.invitation.decline\|Decline Workspace Invitation]] | Accept or decline invitation |

## Steps

| Step                         | Kind     | Target                                     | Next                                                  | Actor interaction                          | System behavior                                      | Rules and validation                                  | External systems       |
| ---------------------------- | -------- | ------------------------------------------ | ----------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------- | ---------------------- |
| Inspect invitation           | presents | Workspace invitation intent and lifecycle | Known User identity, GitHub identity, Verified email | Recognize who invites, where, and with what access | Resolve invitation provenance and lifecycle          | Invitation is active, pending, and unexpired          |                        |
| Known User identity          | context  | authenticated Atlas User                   | Accept or decline invitation                         | Confirm the currently authenticated account | Match the authenticated User ID                       | Current User equals the invitation target             | authentication ingress |
| GitHub identity              | context  | linked provider identity                   | Accept or decline invitation                         | Prove control of the addressed GitHub identity | Verify provider and stable provider account ID        | Provider identity links to exactly one Atlas User     | GitHub authentication  |
| Verified email               | context  | invitation secret                          | Accept or decline invitation                         | Sign in or create an Atlas account          | Verify the signed invitation secret and bind the User | Secret is valid and does not silently merge accounts  | email and authentication ingress |
| Accept or decline invitation | branch   | recipient choice                           |                                                       | Choose whether to join the Workspace        | Claim the invitation, then apply the chosen response  | Invitation remains pending and claimed by this User   |                        |

## Identity Proof Paths

| Addressed recipient        | Required proof                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Known Atlas User           | Authenticated User ID equals the invitation target                                                                 |
| Observed GitHub identity   | A linked External Identity proves the same provider and stable provider account ID                                  |
| Verified email             | The invitation secret proves mailbox control, then binds the claim to the authenticated User without merging accounts |

Provider login, mutable email, and profile similarity are presentation evidence only. None may
silently link Atlas Users, claim an invitation, or create Membership.

The Atlas realization preserves the invitation deep link through authentication. When the current
Atlas User cannot prove the invitation's exact known-User or provider identity, Atlas withholds the
Workspace, inviter, role, and expiry context and offers an explicit switch-account path back to the
same invitation. Switching accounts never merges Users or weakens the recipient proof boundary.

## Operation Responsibilities

| Responsibility             | Operation                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Bind proven recipient      | [[spec-workstream-atlas.access-identity.workspace.invitation.claim\|Claim Workspace Invitation]]                  |
| Create accepted Membership | [[spec-workstream-atlas.access-identity.workspace.invitation.accept\|Accept Workspace Invitation]]                |
| Record explicit refusal    | [[spec-workstream-atlas.access-identity.workspace.invitation.decline\|Decline Workspace Invitation]]              |

Claim verifies that a pending invitation and the authenticated User satisfy the addressing proof;
it does not grant Workspace access. Accept requires that claim and creates or activates Membership
atomically. Decline closes the invitation without creating Membership. Expiry and owner revocation
are lifecycle changes that this Interaction observes rather than recipient affordances.

## Outcomes

| Outcome                | Meaning                                                                  | From                         | Continues With |
| ---------------------- | ------------------------------------------------------------------------ | ---------------------------- | -------------- |
| Invitation accepted    | Membership is active with the invited role                               | Accept or decline invitation |                |
| Invitation declined    | Invitation is closed and no Membership is created                        | Accept or decline invitation |                |
| Invitation unavailable | Invitation expired, was revoked, or no longer satisfies Workspace policy | Inspect invitation           |                |
| Identity proof refused | Current User cannot claim the addressed invitation                       |                              |                |
| Response abandoned     | Invitation remains pending until another lifecycle transition            |                              |                |

The invitation link, email click, OAuth callback, and sign-in form are stimuli or realization
details. They may carry the actor into this Interaction, but they are not substitutes for claim or
acceptance Operations.
