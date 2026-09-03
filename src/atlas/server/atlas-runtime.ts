import { createRuntimeProtocolDispatcher } from '@ontahi/core/runtime/protocol';
import type { OperationInvocationRequest } from '@ontahi/core/runtime/operation-invocation';
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

type OperationDispatcherApplication = Parameters<
  typeof createOperationInvocationDispatcher
>[0];

export const createAtlasBridgeOperationDispatcher = (
  application: OperationDispatcherApplication,
) =>
  createOperationInvocationDispatcher({
    ...application,
    resolveOperation: operationId => {
      const operation = application.resolveOperation(operationId);

      return operation?.exposure === 'bridge' ? operation : undefined;
    },
  });

export const dispatchAtlasBridgeOperationRequest = async (
  request: OperationInvocationRequest,
) => {
  const atlas = await getAtlasServerApplication();
  return createAtlasBridgeOperationDispatcher(atlas.application)(request);
};

export const dispatchAtlasRuntimeRequest = createRuntimeProtocolDispatcher({
  handlers: {
    operation: (request, context: AtlasRuntimeRequestContext) =>
      withAtlasRuntimeRequestContext(context, () =>
        dispatchAtlasBridgeOperationRequest(request),
      ),
  },
});
