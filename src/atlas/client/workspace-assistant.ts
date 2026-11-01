'use client';

import {
  defineClientDomainOperation,
  defineClientEntity,
} from '@ontahi/core/data-graph';

import {
  AtlasPlanAssistantInputSchema,
  AtlasPlanAssistantOutputSchema,
} from '../model/plan-assistant';

export const AtlasWorkspaceAssistantClient = defineClientEntity('AtlasWorkspace', {
  domainOperations: {
    askPlans: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      input: AtlasPlanAssistantInputSchema,
      output: AtlasPlanAssistantOutputSchema,
    }),
  },
});
