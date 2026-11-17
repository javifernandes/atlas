'use client';

import {
  defineClientDomainOperation,
  defineClientEntity,
} from '@ontahi/core/data-graph';

import {
  AtlasWorkspaceCreateInputSchema,
  AtlasWorkspaceCreateOutputSchema,
  AtlasWorkspaceDeleteInputSchema,
  AtlasWorkspaceDeleteOutputSchema,
  AtlasWorkspaceRegisterSourceInputSchema,
  AtlasWorkspaceRegisterSourceOutputSchema,
  AtlasWorkspaceRemoveSourceInputSchema,
  AtlasWorkspaceRemoveSourceOutputSchema,
  AtlasWorkspaceReconcileSourcesInputSchema,
  AtlasWorkspaceReconcileSourcesOutputSchema,
  AtlasWorkspaceListRepositoriesInputSchema,
  AtlasWorkspaceListRepositoriesOutputSchema,
  AtlasWorkspaceUpdateVisibilityInputSchema,
  AtlasWorkspaceUpdateVisibilityOutputSchema,
} from '../model/workspace-administration';

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
