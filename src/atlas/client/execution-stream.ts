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
  AtlasExecutionStreamSetArchivedInputSchema,
  AtlasExecutionStreamSetArchivedOutputSchema,
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
    setArchived: defineClientDomainOperation({
      authority: 'server',
      exposure: 'bridge',
      bridge: {},
      input: AtlasExecutionStreamSetArchivedInputSchema,
      output: AtlasExecutionStreamSetArchivedOutputSchema,
    }),
  },
});
