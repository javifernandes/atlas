'use client';

import {
  defineClientDomainOperation,
  defineClientEntity,
} from '@ontahi/core';

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
      receiver: {
        kind: 'input',
        path: 'workspace',
        entityName: 'AtlasWorkspace',
        participant: 'ref',
        requirement: 'portable',
        source: 'declaration',
      },
      input: AtlasPlanAssistantInputSchema,
      output: AtlasPlanAssistantOutputSchema,
    }),
  },
});
