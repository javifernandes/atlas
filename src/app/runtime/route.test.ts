// @vitest-environment node

import {
  createRuntimeProtocolRequest,
  createRuntimeProtocolResponse,
  toOperationProtocolRequest,
} from '@ontahi/core/runtime/protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasRuntimeInvocationContextMock = vi.hoisted(() => vi.fn());
const getAtlasServerApplicationMock = vi.hoisted(() => vi.fn());
const dispatcherMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth/server', () => ({
  getAtlasRuntimeInvocationContext: getAtlasRuntimeInvocationContextMock,
}));
vi.mock('@/atlas/server/atlas-composition', () => ({
  getAtlasServerApplication: getAtlasServerApplicationMock,
}));

import { POST } from './route';

const operationRequest = createRuntimeProtocolRequest({
  id: 'atlas-operation-1',
  family: 'operation',
  body: toOperationProtocolRequest({
    kind: 'invoke',
    operationId: 'AtlasExecutionStream.close',
    input: { id: 'stream-1' },
  }),
});

const request = (body: unknown) =>
  new Request('http://atlas.test/runtime', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('Atlas Runtime Protocol route', () => {
  beforeEach(() => {
    dispatcherMock.mockReset().mockImplementation(async input =>
      createRuntimeProtocolResponse(input, {
        kind: 'invocation-result',
        result: { ok: true, kind: 'success', value: { id: 'stream-1', closed: true } },
      }),
    );
    getAtlasServerApplicationMock.mockReset().mockResolvedValue({
      runtimeProtocol: { dispatcher: dispatcherMock },
    });
    getAtlasRuntimeInvocationContextMock.mockReset().mockResolvedValue({
      principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
    });
  });

  it('rejects an invalid envelope before loading Atlas or resolving identity', async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(getAtlasServerApplicationMock).not.toHaveBeenCalled();
    expect(getAtlasRuntimeInvocationContextMock).not.toHaveBeenCalled();
    expect(dispatcherMock).not.toHaveBeenCalled();
  });

  it('mounts the lazy application receiver with trusted Atlas context', async () => {
    const response = await POST(request(operationRequest));

    expect(response.status).toBe(200);
    expect(getAtlasServerApplicationMock).toHaveBeenCalledOnce();
    expect(getAtlasRuntimeInvocationContextMock).toHaveBeenCalledOnce();
    expect(dispatcherMock).toHaveBeenCalledWith(
      operationRequest,
      { principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' } },
      { signal: expect.any(AbortSignal) },
    );
    await expect(response.json()).resolves.toMatchObject({
      family: 'operation',
      body: { result: { ok: true, value: { closed: true } } },
    });
  });

  it('fails closed when trusted Atlas context cannot be resolved', async () => {
    getAtlasRuntimeInvocationContextMock.mockRejectedValue(
      new Error('Private Atlas visibility requires GitHub OAuth.'),
    );

    const response = await POST(request(operationRequest));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'dispatch_unavailable' },
    });
    expect(dispatcherMock).not.toHaveBeenCalled();
  });
});
