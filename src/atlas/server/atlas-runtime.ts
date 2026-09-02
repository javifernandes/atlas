import { createRuntimeProtocolDispatcher } from '@ontahi/core/runtime/protocol';
import { createOperationInvocationDispatcher } from '@ontahi/core/runtime/server';

import { getAtlasServerApplication } from './atlas-composition';

export const dispatchAtlasRuntimeRequest = createRuntimeProtocolDispatcher({
  handlers: {
    operation: async request => {
      const atlas = await getAtlasServerApplication();
      const dispatchOperation = createOperationInvocationDispatcher(atlas.application);

      return dispatchOperation(request);
    },
  },
});
