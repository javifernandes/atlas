'use client';

import {
  defineClientDomainOperation,
  defineClientEntity,
} from '@ontahi/core';

import {
  AtlasWorkspaceCreateInputSchema,
  AtlasWorkspaceCreateOutputSchema,
  AtlasWorkspaceDeleteInputSchema,
  AtlasWorkspaceDeleteOutputSchema,
  AtlasWorkspaceInviteInputSchema,
  AtlasWorkspaceInviteOutputSchema,
  AtlasWorkspaceInvitationAcceptOutputSchema,
  AtlasWorkspaceInvitationClaimInputSchema,
  AtlasWorkspaceInvitationClaimOutputSchema,
  AtlasWorkspaceInvitationDeclineOutputSchema,
  AtlasWorkspaceInvitationInspectInputSchema,
  AtlasWorkspaceInvitationInspectOutputSchema,
  AtlasWorkspaceInvitationRespondInputSchema,
  AtlasWorkspaceRegisterSourceInputSchema,
  AtlasWorkspaceRegisterSourceOutputSchema,
  AtlasWorkspaceRevokeInvitationInputSchema,
  AtlasWorkspaceRevokeInvitationOutputSchema,
  AtlasWorkspaceRemoveSourceInputSchema,
  AtlasWorkspaceRemoveSourceOutputSchema,
  AtlasWorkspaceReconcileSourcesInputSchema,
  AtlasWorkspaceReconcileSourcesOutputSchema,
  AtlasWorkspaceListRepositoriesInputSchema,
  AtlasWorkspaceListRepositoriesOutputSchema,
  AtlasWorkspaceUpdateVisibilityInputSchema,
  AtlasWorkspaceUpdateVisibilityOutputSchema,
} from '../model/workspace-administration';

const invitationReceiver = {
  kind: 'input',
  path: 'invitation',
  entityName: 'AtlasWorkspaceInvitation',
  participant: 'ref',
  requirement: 'portable',
  source: 'declaration',
} as const;

export const AtlasWorkspaceInvitationClient = defineClientEntity(
  'AtlasWorkspaceInvitation',
  {
    domainOperations: {
      inspect: defineClientDomainOperation({
        authority: 'server',
        exposure: 'bridge',
        bridge: {},
        receiver: invitationReceiver,
        input: AtlasWorkspaceInvitationInspectInputSchema,
        output: AtlasWorkspaceInvitationInspectOutputSchema,
      }),
      claim: defineClientDomainOperation({
        authority: 'server',
        exposure: 'bridge',
        bridge: {},
        receiver: invitationReceiver,
        input: AtlasWorkspaceInvitationClaimInputSchema,
        output: AtlasWorkspaceInvitationClaimOutputSchema,
      }),
      accept: defineClientDomainOperation({
        authority: 'server',
        exposure: 'bridge',
        bridge: {},
        receiver: invitationReceiver,
        input: AtlasWorkspaceInvitationRespondInputSchema,
        output: AtlasWorkspaceInvitationAcceptOutputSchema,
      }),
      decline: defineClientDomainOperation({
        authority: 'server',
        exposure: 'bridge',
        bridge: {},
        receiver: invitationReceiver,
        input: AtlasWorkspaceInvitationRespondInputSchema,
        output: AtlasWorkspaceInvitationDeclineOutputSchema,
      }),
    },
  },
);

const workspaceReceiver = {
  kind: 'input',
  path: 'workspace',
  entityName: 'AtlasWorkspace',
  participant: 'ref',
  requirement: 'portable',
  source: 'declaration',
} as const;

export const AtlasWorkspaceAdministrationClient = defineClientEntity('AtlasWorkspace', {
  domainOperations: {
    create: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      input: AtlasWorkspaceCreateInputSchema,
      output: AtlasWorkspaceCreateOutputSchema,
    }),
    delete: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      receiver: workspaceReceiver,
      input: AtlasWorkspaceDeleteInputSchema,
      output: AtlasWorkspaceDeleteOutputSchema,
    }),
    invite: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      receiver: workspaceReceiver,
      input: AtlasWorkspaceInviteInputSchema,
      output: AtlasWorkspaceInviteOutputSchema,
    }),
    revokeInvitation: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      receiver: workspaceReceiver,
      input: AtlasWorkspaceRevokeInvitationInputSchema,
      output: AtlasWorkspaceRevokeInvitationOutputSchema,
    }),
    updateVisibility: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      receiver: workspaceReceiver,
      input: AtlasWorkspaceUpdateVisibilityInputSchema,
      output: AtlasWorkspaceUpdateVisibilityOutputSchema,
    }),
    registerSource: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      receiver: workspaceReceiver,
      input: AtlasWorkspaceRegisterSourceInputSchema,
      output: AtlasWorkspaceRegisterSourceOutputSchema,
    }),
    removeSource: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      receiver: workspaceReceiver,
      input: AtlasWorkspaceRemoveSourceInputSchema,
      output: AtlasWorkspaceRemoveSourceOutputSchema,
    }),
    reconcileSources: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      receiver: workspaceReceiver,
      input: AtlasWorkspaceReconcileSourcesInputSchema,
      output: AtlasWorkspaceReconcileSourcesOutputSchema,
      durable: {
        runtime: 'in-process',
        taskId: 'atlas.workspace.reconcile-sources',
        finalOutput: AtlasWorkspaceReconcileSourcesOutputSchema,
      },
    }),
    listRepositories: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      receiver: workspaceReceiver,
      input: AtlasWorkspaceListRepositoriesInputSchema,
      output: AtlasWorkspaceListRepositoriesOutputSchema,
    }),
  },
});
