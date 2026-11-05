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
    listRepositories: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      input: AtlasWorkspaceListRepositoriesInputSchema,
      output: AtlasWorkspaceListRepositoriesOutputSchema,
    }),
  },
});
