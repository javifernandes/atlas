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
      input: AtlasWorkspaceDeleteInputSchema,
      output: AtlasWorkspaceDeleteOutputSchema,
    }),
    updateVisibility: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      input: AtlasWorkspaceUpdateVisibilityInputSchema,
      output: AtlasWorkspaceUpdateVisibilityOutputSchema,
    }),
    registerSource: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      input: AtlasWorkspaceRegisterSourceInputSchema,
      output: AtlasWorkspaceRegisterSourceOutputSchema,
    }),
    removeSource: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      input: AtlasWorkspaceRemoveSourceInputSchema,
      output: AtlasWorkspaceRemoveSourceOutputSchema,
    }),
    reconcileSources: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
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
      input: AtlasWorkspaceListRepositoriesInputSchema,
      output: AtlasWorkspaceListRepositoriesOutputSchema,
    }),
  },
});
