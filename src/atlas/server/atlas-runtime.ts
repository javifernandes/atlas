import { createRuntimeProtocolDispatcher } from '@ontahi/core/runtime/protocol';
import { createOperationInvocationDispatcher } from '@ontahi/core/runtime/server';

import { loadAtlasServerApplication } from './get-atlas-page-data';

let runtimeApplication: ReturnType<typeof loadAtlasServerApplication> | undefined;

const getAtlasRuntimeApplication = () => {
  runtimeApplication ??= loadAtlasServerApplication().catch(error => {
    runtimeApplication = undefined;
    throw error;
  });

  return runtimeApplication;
};

export const dispatchAtlasRuntimeRequest = createRuntimeProtocolDispatcher({
  handlers: {
    operation: async request => {
      const { atlas } = await getAtlasRuntimeApplication();
      const dispatchOperation = createOperationInvocationDispatcher(atlas.application);

      return dispatchOperation(request);
    },
  },
});
