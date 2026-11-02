'use client';

import {
  defineClientDomainOperation,
  defineClientEntity,
} from '@ontahi/core/data-graph';

import {
  AtlasWorkspaceCreateInputSchema,
  AtlasWorkspaceCreateOutputSchema,
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
    updateVisibility: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      input: AtlasWorkspaceUpdateVisibilityInputSchema,
      output: AtlasWorkspaceUpdateVisibilityOutputSchema,
    }),
  },
});
