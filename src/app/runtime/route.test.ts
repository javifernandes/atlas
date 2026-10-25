// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasRequestAccessMock = vi.hoisted(() => vi.fn());
const getAtlasWorkspaceForUserMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth/server', () => ({
  getAtlasRequestAccess: getAtlasRequestAccessMock,
}));
vi.mock('@/atlas/workspace/workspace-access', () => ({
  getAtlasWorkspaceForUser: getAtlasWorkspaceForUserMock,
}));

import { POST } from './route';

describe('Atlas Runtime Protocol route', () => {
  beforeEach(() => {
    getAtlasRequestAccessMock.mockReset().mockResolvedValue({
      authAvailable: false,
      canRead: true,
      configurationError: null,
      principal: null,
      viewer: null,
      visibility: 'public',
    });
    getAtlasWorkspaceForUserMock.mockReset().mockResolvedValue({ id: 'workspace-1' });
  });

  it('maps an invalid envelope to a protocol-aware HTTP response', async () => {
    const response = await POST(
      new Request('http://atlas.test/runtime', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      protocol: 'ontahi.runtime',
      version: 1,
      kind: 'protocol-error',
      error: { code: 'invalid_envelope' },
    });
  });

  it('rejects anonymous access to a private Atlas before dispatch', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: false,
      configurationError: null,
      principal: null,
      viewer: null,
      visibility: 'private',
    });

    const response = await POST(
      new Request('http://atlas.test/runtime', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'not_authenticated' });
  });

  it('fails closed when private authentication is misconfigured', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: false,
      canRead: false,
      configurationError: 'Private Atlas visibility requires GitHub OAuth.',
      principal: null,
      viewer: null,
      visibility: 'private',
    });

    const response = await POST(
      new Request('http://atlas.test/runtime', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'atlas_auth_misconfigured',
    });
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
      new Request('http://atlas.test/runtime', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'not_authorized' });
  });
});
