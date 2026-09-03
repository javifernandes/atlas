// @vitest-environment node

import { graphSchema } from '@ontahi/core/data-graph';
import { getCurrentPrincipal } from '@ontahi/core/runtime/server';
import { describe, expect, it, vi } from 'vitest';

import {
  createAtlasBridgeOperationDispatcher,
  withAtlasRuntimeRequestContext,
} from './atlas-runtime';

describe('Atlas Runtime Protocol identity', () => {
  it('makes the request Principal visible to Ontahí execution', async () => {
    const principal = {
      issuer: 'atlas',
      kind: 'user' as const,
      subject: 'github-user-1',
    };

    await expect(
      withAtlasRuntimeRequestContext({ principal }, async () => getCurrentPrincipal()),
    ).resolves.toEqual(principal);
  });

  it('preserves an explicit anonymous request context', () => {
    expect(withAtlasRuntimeRequestContext({ principal: null }, () => getCurrentPrincipal())).toBe(
      null,
    );
  });

  it('exposes only operations explicitly declared for the bridge', async () => {
    const invokeOperation = vi.fn().mockResolvedValue({
      ok: true,
      kind: 'success',
      value: { closed: true },
    });
    const bridgeOperation = {
      id: 'AtlasExecutionStream.close',
      exposure: 'bridge',
      input: graphSchema.object({}),
    };
    const serverOnlyOperation = {
      id: 'ProjectionRevision.reconcile',
      exposure: 'server-only',
      input: undefined,
    };
    const dispatch = createAtlasBridgeOperationDispatcher({
      resolveOperation: operationId =>
        operationId === bridgeOperation.id
          ? (bridgeOperation as never)
          : operationId === serverOnlyOperation.id
            ? (serverOnlyOperation as never)
            : undefined,
      invokeOperation,
      checkPermission: vi.fn().mockResolvedValue({ allowed: true }),
    });

    await expect(
      dispatch({
        kind: 'invoke',
        operationId: serverOnlyOperation.id,
        input: {},
      }),
    ).resolves.toMatchObject({
      kind: 'invocation-result',
      result: { ok: false, kind: 'rejected', reason: 'unknown_operation' },
    });
    await expect(
      dispatch({
        kind: 'invoke',
        operationId: bridgeOperation.id,
        input: {},
      }),
    ).resolves.toMatchObject({
      kind: 'invocation-result',
      result: { ok: true, value: { closed: true } },
    });
    expect(invokeOperation).toHaveBeenCalledOnce();
  });
});
