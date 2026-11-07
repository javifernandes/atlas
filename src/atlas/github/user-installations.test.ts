// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { listAtlasGitHubInstallationRepositories } from './user-installations';

describe('GitHub App repository discovery', () => {
  it('lists only repositories granted through installations accessible to the logged-in user', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/user/installations?')) {
        return Response.json({ installations: [{ id: 41 }, { id: 42 }] });
      }
      if (url.includes('/41/repositories')) {
        return Response.json({ repositories: [{
          default_branch: 'main',
          full_name: 'acme/product',
          private: true,
        }] });
      }
      if (url.includes('/42/repositories')) {
        return Response.json({ repositories: [{
          default_branch: 'trunk',
          full_name: 'acme/docs',
          private: false,
        }] });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    await expect(listAtlasGitHubInstallationRepositories({
      accessToken: 'user-access-token',
      fetcher,
      installationUrl: 'https://github.test/apps/atlas/installations/new',
    })).resolves.toEqual({
      connectionRequired: false,
      installationUrl: 'https://github.test/apps/atlas/installations/new',
      repositories: [
        { defaultRef: 'main', fullName: 'acme/product', installationId: '41', isPrivate: true },
        { defaultRef: 'trunk', fullName: 'acme/docs', installationId: '42', isPrivate: false },
      ],
    });
  });

  it('requires an App connection when the user has no accessible installation', async () => {
    const fetcher = vi.fn(async () => Response.json({ installations: [] })) as typeof fetch;

    await expect(listAtlasGitHubInstallationRepositories({
      accessToken: 'user-access-token',
      fetcher,
      installationUrl: 'https://github.test/install',
    })).resolves.toEqual({
      connectionRequired: true,
      installationUrl: 'https://github.test/install',
      repositories: [],
    });
  });
});
