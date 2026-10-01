// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasRequestAccessMock = vi.hoisted(() => vi.fn());
const getAtlasServerApplicationMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth/server', () => ({
  getAtlasRequestAccess: getAtlasRequestAccessMock,
}));
vi.mock('@/atlas/server/atlas-composition', () => ({
  getAtlasServerApplication: getAtlasServerApplicationMock,
}));

import { GET } from './route';

describe('Atlas node content route', () => {
  beforeEach(() => {
    getAtlasRequestAccessMock.mockReset().mockResolvedValue({
      authAvailable: false,
      canRead: true,
      configurationError: null,
      principal: null,
      viewer: null,
      visibility: 'public',
    });
    getAtlasServerApplicationMock.mockReset().mockResolvedValue({
      getProjectionSnapshot: vi.fn().mockResolvedValue({
        nodes: [{ id: 'plan:one', markdown: '# Plan one' }],
        documents: [{ id: 'document:one', markdown: '# Document one' }],
      }),
    });
  });

  it('returns one Markdown body without exposing the full snapshot', async () => {
    const response = await GET(
      new Request('http://atlas.test/api/node-content?nodeId=document%3Aone'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ markdown: '# Document one' });
  });

  it('uses a storage-bounded content projection when available', async () => {
    const getProjectionNodeContent = vi.fn().mockResolvedValue('# Projected node');
    const getProjectionSnapshot = vi.fn();
    getAtlasServerApplicationMock.mockResolvedValue({
      getProjectionNodeContent,
      getProjectionSnapshot,
    });

    const response = await GET(
      new Request('http://atlas.test/api/node-content?nodeId=plan%3Aone'),
    );

    await expect(response.json()).resolves.toEqual({ markdown: '# Projected node' });
    expect(getProjectionNodeContent).toHaveBeenCalledWith('plan:one');
    expect(getProjectionSnapshot).not.toHaveBeenCalled();
  });

  it('rejects anonymous access to a private Atlas', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: false,
      configurationError: null,
      principal: null,
      viewer: null,
      visibility: 'private',
    });

    const response = await GET(
      new Request('http://atlas.test/api/node-content?nodeId=plan%3Aone'),
    );

    expect(response.status).toBe(401);
    expect(getAtlasServerApplicationMock).not.toHaveBeenCalled();
  });

  it('returns not found for an unknown node', async () => {
    const response = await GET(
      new Request('http://atlas.test/api/node-content?nodeId=missing'),
    );

    expect(response.status).toBe(404);
  });
});
