'use client';

import {
  defineClientDomainOperation,
  defineClientEntity,
} from '@ontahi/core/data-graph';

import {
  AtlasExecutionStreamCloseInputSchema,
  AtlasExecutionStreamCloseOutputSchema,
} from '../model/execution-stream';

export const AtlasExecutionStreamClient = defineClientEntity('AtlasExecutionStream', {
  domainOperations: {
    close: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      input: AtlasExecutionStreamCloseInputSchema,
      output: AtlasExecutionStreamCloseOutputSchema,
    }),
  },
});
