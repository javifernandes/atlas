import { Effect } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasServerApplicationMock = vi.hoisted(() => vi.fn());
const putSecretMock = vi.hoisted(() => vi.fn());
const getSecretMock = vi.hoisted(() => vi.fn());
const deleteSecretMock = vi.hoisted(() => vi.fn());

vi.mock('@/atlas/server/atlas-composition', () => ({
  getAtlasServerApplication: getAtlasServerApplicationMock,
}));
vi.mock('@/atlas/server/secret-store', () => ({
  createAtlasSecretStore: () => ({
    delete: deleteSecretMock,
    get: getSecretMock,
    put: putSecretMock,
  }),
  readAtlasSecretStoreConfiguration: () => ({
    available: true,
    config: 'dev',
    project: 'atlas',
    provider: 'doppler',
  }),
}));
vi.mock('@/atlas/server/model-provider', () => ({
  readAtlasModelConfiguration: () => ({ enabled: false, model: null, provider: null }),
}));
vi.mock('@/auth/server', () => ({
  getAtlasRequestAccess: () => Promise.resolve({
    canRead: true,
    principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
    viewer: { id: 'user-1' },
  }),
}));
vi.mock('@/atlas/workspace/workspace-access', () => ({
  getAtlasWorkspaceForUser: () => Promise.resolve({
    id: '00000000-0000-4000-8000-000000000137',
    role: 'owner',
    slug: 'atlas',
  }),
}));

import { createAtlasOntahiApplication } from '@/atlas/domain/atlas-application';
import { DELETE, GET, PUT } from './route';

const context = { params: { slug: 'atlas' } };

describe('Workspace model connection confidential ingress', () => {
  beforeEach(() => {
    const atlas = createAtlasOntahiApplication([], {
      workspaceRoleFor: () => Effect.succeed('owner'),
    });
    getAtlasServerApplicationMock.mockResolvedValue(atlas);
    putSecretMock.mockReset().mockResolvedValue(undefined);
    getSecretMock.mockReset().mockResolvedValue('provider-secret-key');
    deleteSecretMock.mockReset().mockResolvedValue(undefined);
  });

  it('stores the credential externally and returns only safe metadata', async () => {
    const response = await PUT(new Request('http://atlas.test/api/workspaces/atlas/model-connection', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiKey: 'provider-secret-key',
        baseUrl: '',
        model: 'gpt-test',
        provider: 'openai',
      }),
    }), context);
    const serialized = await response.text();

    expect(response.status).toBe(200);
    expect(putSecretMock).toHaveBeenCalledWith(expect.stringMatching(/^ATLAS_MODEL_CONNECTION_/), 'provider-secret-key');
    expect(serialized).toContain('gpt-test');
    expect(serialized).not.toContain('provider-secret-key');
    expect(serialized).not.toContain('secretRef');

    const read = await GET(new Request('http://atlas.test/api/workspaces/atlas/model-connection'), context);
    expect(await read.json()).toMatchObject({
      connection: { model: 'gpt-test', provider: 'openai', secretSuffix: '-key', status: 'active' },
    });
  });

  it('disables metadata and removes its external secret', async () => {
    await PUT(new Request('http://atlas.test/api/workspaces/atlas/model-connection', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey: 'provider-secret-key', model: 'gpt-test', provider: 'openai' }),
    }), context);
    const response = await DELETE(
      new Request('http://atlas.test/api/workspaces/atlas/model-connection', { method: 'DELETE' }),
      context,
    );

    expect(response.status).toBe(200);
    expect(deleteSecretMock).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({ connection: { status: 'disabled' } });
  });
});
