// @vitest-environment node

import { generateKeyPairSync } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearAtlasGitHubInstallationTokenCache,
  getAtlasGitHubRequestHeaders,
} from './installation-client';

const originalAppId = process.env.ATLAS_GITHUB_APP_ID;
const originalPrivateKey = process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64;
const originalToken = process.env.ATLAS_GITHUB_TOKEN;

afterEach(() => {
  clearAtlasGitHubInstallationTokenCache();

  for (const [key, value] of [
    ['ATLAS_GITHUB_APP_ID', originalAppId],
    ['ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64', originalPrivateKey],
    ['ATLAS_GITHUB_TOKEN', originalToken],
  ] as const) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('Atlas GitHub App installation client', () => {
  it('discovers the repository installation and caches its short-lived token', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.ATLAS_GITHUB_APP_ID = '1234';
    process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64 = Buffer.from(privateKeyPem).toString('base64');
    delete process.env.ATLAS_GITHUB_TOKEN;
    const fetcherMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/repos/acme/product/installation')) {
        return Response.json({ id: 9876 });
      }

      if (url.endsWith('/app/installations/9876/access_tokens')) {
        return Response.json({
          token: 'installation-token',
          expires_at: '2099-01-01T00:00:00Z',
        });
      }

      return new Response('not found', { status: 404 });
    });
    const fetcher = fetcherMock as typeof fetch;

    const first = await getAtlasGitHubRequestHeaders({
      fetcher,
      repositoryFullName: 'acme/product',
    });
    const second = await getAtlasGitHubRequestHeaders({
      fetcher,
      repositoryFullName: 'acme/product',
    });

    expect(first.Authorization).toBe('Bearer installation-token');
    expect(second.Authorization).toBe('Bearer installation-token');
    expect(fetcherMock).toHaveBeenCalledTimes(2);
    expect(fetcherMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
  });
});
