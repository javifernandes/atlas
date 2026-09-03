'use client';

import {
  defineClientDomainOperation,
  defineClientEntity,
} from '@ontahi/core/data-graph';

import {
  AtlasExecutionStreamCloseInputSchema,
  AtlasExecutionStreamCloseOutputSchema,
  AtlasExecutionStreamForkInputSchema,
  AtlasExecutionStreamForkOutputSchema,
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
    fork: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      input: AtlasExecutionStreamForkInputSchema,
      output: AtlasExecutionStreamForkOutputSchema,
    }),
  },
});
