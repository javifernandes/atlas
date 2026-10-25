// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentPrincipal, type Principal } from '@ontahi/core/runtime/server';

const getAtlasRequestAccessMock = vi.hoisted(() => vi.fn());
const getAtlasWorkspaceForUserMock = vi.hoisted(() => vi.fn());
const dispatchOperationMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth/server', () => ({
  getAtlasRequestAccess: getAtlasRequestAccessMock,
}));
vi.mock('@/atlas/workspace/workspace-access', () => ({
  getAtlasWorkspaceForUser: getAtlasWorkspaceForUserMock,
}));
vi.mock('@/atlas/server/atlas-runtime', () => ({
  dispatchAtlasBridgeOperationRequest: dispatchOperationMock,
}));

import { POST } from './route';

describe('Atlas Operation bridge route', () => {
  let observedPrincipal: Principal | null = null;

  beforeEach(() => {
    observedPrincipal = null;
    getAtlasRequestAccessMock.mockReset().mockResolvedValue({
      authAvailable: true,
      canRead: true,
      configurationError: null,
      principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
      viewer: { id: 'user-1' },
      visibility: 'public',
    });
    getAtlasWorkspaceForUserMock.mockReset().mockResolvedValue({ id: 'workspace-1' });
    dispatchOperationMock.mockReset().mockImplementation(async () => {
      observedPrincipal = getCurrentPrincipal();
      return {
        kind: 'invocation-result',
        result: {
          ok: true,
          kind: 'success',
          value: { id: 'stream-1', closed: true, closedAt: '2026-09-03T00:00:00.000Z' },
        },
      };
    });
  });

  it('dispatches the generic bridged operation with the authenticated Principal', async () => {
    const response = await POST(
      new Request('http://atlas.test/operations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'invoke',
          operationId: 'AtlasExecutionStream.close',
          input: { id: 'stream-1' },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(dispatchOperationMock).toHaveBeenCalledWith({
      kind: 'invoke',
      operationId: 'AtlasExecutionStream.close',
      input: { id: 'stream-1' },
    });
    expect(observedPrincipal).toEqual({
      issuer: 'atlas',
      kind: 'user',
      subject: 'user-1',
    });
    await expect(response.json()).resolves.toMatchObject({
      kind: 'invocation-result',
      result: { ok: true, value: { id: 'stream-1', closed: true } },
    });
  });

  it('rejects anonymous private access before operation dispatch', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: false,
      configurationError: null,
      principal: null,
      viewer: null,
      visibility: 'private',
    });

    const response = await POST(
      new Request('http://atlas.test/operations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(401);
    expect(dispatchOperationMock).not.toHaveBeenCalled();
  });

  it('rejects authenticated private access without an active Workspace membership', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: true,
      configurationError: null,
      principal: { issuer: 'atlas', kind: 'user', subject: 'user-2' },
      viewer: { id: 'user-2' },
      visibility: 'private',
    });
    getAtlasWorkspaceForUserMock.mockResolvedValue(null);

    const response = await POST(
      new Request('http://atlas.test/operations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(403);
    expect(dispatchOperationMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: 'not_authorized' });
  });
});
