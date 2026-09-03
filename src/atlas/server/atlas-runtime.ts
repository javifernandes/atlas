import { createRuntimeProtocolDispatcher } from '@ontahi/core/runtime/protocol';
import {
  createOperationInvocationDispatcher,
  withInvocationContext,
  type Principal,
} from '@ontahi/core/runtime/server';

import { getAtlasServerApplication } from './atlas-composition';

export type AtlasRuntimeRequestContext = {
  principal: Principal | null;
};

export const withAtlasRuntimeRequestContext = <TValue>(
  context: AtlasRuntimeRequestContext,
  run: () => TValue,
) => withInvocationContext({ principal: context.principal }, run);

export const dispatchAtlasRuntimeRequest = createRuntimeProtocolDispatcher({
  handlers: {
    operation: async (request, context: AtlasRuntimeRequestContext) => {
      const atlas = await getAtlasServerApplication();
      const dispatchOperation = createOperationInvocationDispatcher(atlas.application);

      return withAtlasRuntimeRequestContext(context, () => dispatchOperation(request));
    },
  },
});
