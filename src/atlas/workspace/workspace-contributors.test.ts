import { describe, expect, it } from 'vitest';

import { deriveWorkspaceContributors } from './workspace-contributors';

describe('deriveWorkspaceContributors', () => {
  it('derives explainable Workspace-scoped participants from stable provider identities', () => {
    const contributors = deriveWorkspaceContributors({
      linkedUserIdByGithubAccountId: new Map([['42', 'user-1']]),
      sources: [{ id: 'source-1', sourceId: 'atlas', workspaceId: 'workspace-1' }],
      pullRequests: [
        {
          authorAvatarUrl: 'https://example.com/older.png',
          authorLogin: 'javi',
          authorProviderAccountId: '42',
          mergedAt: '2026-10-01T00:00:00.000Z',
          sourceId: 'atlas',
        },
        {
          authorAvatarUrl: 'https://example.com/latest.png',
          authorLogin: 'javi-renamed',
          authorProviderAccountId: '42',
          mergedAt: '2026-11-01T00:00:00.000Z',
          sourceId: 'atlas',
        },
        {
          authorAvatarUrl: null,
          authorLogin: 'dependabot[bot]',
          authorProviderAccountId: 'bot-1',
          mergedAt: '2026-10-15T00:00:00.000Z',
          sourceId: 'atlas',
        },
        {
          authorAvatarUrl: null,
          authorLogin: 'email-only',
          authorProviderAccountId: null,
          mergedAt: '2026-10-20T00:00:00.000Z',
          sourceId: 'atlas',
        },
      ],
    });

    expect(contributors).toEqual([
      expect.objectContaining({
        contributionCount: 2,
        lastContributedAt: '2026-11-01T00:00:00.000Z',
        linkedUserId: 'user-1',
        login: 'javi-renamed',
        providerAccountId: '42',
      }),
      expect.objectContaining({ kind: 'bot', login: 'dependabot[bot]' }),
    ]);
  });
});
