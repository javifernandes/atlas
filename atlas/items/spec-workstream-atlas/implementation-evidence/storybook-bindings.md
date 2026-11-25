---
id: spec-workstream-atlas.implementation-evidence.storybook-bindings
kind: item
title: Storybook Bindings
parent: spec-workstream-atlas.implementation-evidence
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.implementation-evidence
relatedPlans:
  - plans/current/102-workstream-atlas-implementation-evidence.md
  - bookops://plans/18d-web-phase-2plusplus-storybook-information-architecture
  - bookops://plans/23-feedback-ui-hardening-and-storybook
---

Storybook Bindings connect atlas items to the stories that demonstrate the relevant product states, component states, and visual regression surfaces.

The strongest version embeds or deep-links Storybook stories directly from the selected atlas item, so review can move from semantic intent to inspectable UI without losing context.

## First Binding Contract

The first slice treats a Storybook story as implementation evidence rather than semantic
authority. The Interaction and Entity Items continue to define intended system behavior; the
story owns one inspectable realization of that behavior.

A bound story declares stable Atlas metadata in Storybook parameters:

```ts
parameters: {
  atlas: {
    item: 'spec-workstream-atlas.access-identity.workspace.respond-to-invitation',
    interaction: 'respond-to-workspace-invitation',
    activity: 'resolve-context',
  },
}
```

`item` is the stable Atlas Item ID. `interaction` and `activity` are optional semantic anchors
inside that Item. Storybook's generated URL is not copied into the semantic model. Atlas derives
the current deep link and embedded preview from the configured Storybook base URL.

The Workspace invitation response is the first adoption proof. Its stories should expose the
anonymous, claimable, claimed, identity-mismatch, terminal, loading, and failure states without
requiring GitHub OAuth or multiple real accounts.

## Concrete Realization

`PendingInvitation` is a concrete realization of the `claim-invitation` activity inside
`Respond To Workspace Invitation`:

```ts
export const PendingInvitation: Story = {
  parameters: {
    atlas: {
      item: 'spec-workstream-atlas.access-identity.workspace.respond-to-invitation',
      interaction: 'respond-to-workspace-invitation',
      activity: 'claim-invitation',
    },
  },
};
```

The binding means that the story demonstrates one inspectable UI realization of that activity. It
does not make the story the definition of the activity, and it does not imply that every UI detail
belongs in the Interaction model.

| Story | Atlas Item | Activity | Realized state |
| --- | --- | --- | --- |
| `PendingInvitation` | `Respond To Workspace Invitation` | `claim-invitation` | An authenticated recipient can inspect and claim a pending invitation. |
| `ChooseResponse` | `Respond To Workspace Invitation` | `choose-response` | The claimed recipient can accept or decline the invitation. |
| `IdentityMismatch` | `Respond To Workspace Invitation` | `identity-proof-refused` | The current identity cannot prove control of the invitation target. |

## Evidence Lens v0

The first inspectable slice uses a typed binding registry as a projection seam. The same record
supplies Atlas parameters to the Storybook story and supplies the selected Interaction's Evidence
lens with:

- the semantic Item, Interaction, and activity anchors;
- a human-readable inspectable state and description;
- an embedded preview derived from `NEXT_PUBLIC_ATLAS_STORYBOOK_URL`;
- a deep link to the current Storybook story.

The registry is not semantic authority and does not duplicate Storybook URLs. It is a local,
testable bridge until Atlas can read Storybook's generated index, resolve the stable anchors, and
project the same Evidence lens without a hand-maintained registry.

The Evidence lens owns only the content rendered beneath the Item detail header. It must not add or
enlarge global Workspace chrome over that header; Atlas navigation remains the compact Workspace
menu trigger whether or not an embedded preview is available.

Storybook availability is optional. In development, Atlas may use `http://localhost:6006` when no
explicit URL is configured. Production derives previews and deep links only from
`NEXT_PUBLIC_ATLAS_STORYBOOK_URL`. When that variable is absent, the Evidence lens still presents
the registered Item, Interaction, activity, state, and description, but renders neither an iframe
nor a Storybook link. A bound Storybook realization must never become a runtime dependency of the
Interaction it demonstrates.
