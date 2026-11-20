// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasRequestAccessMock = vi.hoisted(() => vi.fn());
const getAtlasServerApplicationMock = vi.hoisted(() => vi.fn());
const getAtlasWorkspaceForUserMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth/server', () => ({
  getAtlasRequestAccess: getAtlasRequestAccessMock,
}));
vi.mock('@/atlas/server/atlas-composition', () => ({
  getAtlasServerApplication: getAtlasServerApplicationMock,
}));
vi.mock('@/atlas/workspace/workspace-access', () => ({
  getAtlasWorkspaceForUser: getAtlasWorkspaceForUserMock,
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
    getAtlasWorkspaceForUserMock.mockReset().mockResolvedValue({
      id: 'workspace-1',
      name: 'Workspace One',
      role: 'owner',
      slug: 'workspace-one',
      visibility: 'private',
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
    expect(getProjectionNodeContent).toHaveBeenCalledWith('plan:one', undefined);
    expect(getProjectionSnapshot).not.toHaveBeenCalled();
  });

  it('reads content from the authorized Workspace projection', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: true,
      configurationError: null,
      principal: null,
      viewer: { id: 'user-1', name: 'User One' },
      visibility: 'private',
    });
    const getProjectionNodeContent = vi.fn().mockResolvedValue('# Workspace node');
    getAtlasServerApplicationMock.mockResolvedValue({ getProjectionNodeContent });

    const response = await GET(
      new Request(
        'http://atlas.test/api/node-content?nodeId=interaction%3Aone&workspace=workspace-one',
      ),
    );

    await expect(response.json()).resolves.toEqual({ markdown: '# Workspace node' });
    expect(getAtlasWorkspaceForUserMock).toHaveBeenCalledWith('user-1', 'workspace-one');
    expect(getProjectionNodeContent).toHaveBeenCalledWith('interaction:one', 'workspace-1');
  });

  it('does not read content from a Workspace the viewer cannot access', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: true,
      configurationError: null,
      principal: null,
      viewer: { id: 'user-1', name: 'User One' },
      visibility: 'private',
    });
    getAtlasWorkspaceForUserMock.mockResolvedValue(null);

    const response = await GET(
      new Request(
        'http://atlas.test/api/node-content?nodeId=interaction%3Aone&workspace=other',
      ),
    );

    expect(response.status).toBe(404);
    expect(getAtlasServerApplicationMock).not.toHaveBeenCalled();
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
