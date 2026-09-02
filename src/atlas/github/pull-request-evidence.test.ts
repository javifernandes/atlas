// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchAtlasPullRequestEvidence,
  parseAtlasPullRequestDirectives,
} from './pull-request-evidence';

const originalAppId = process.env.ATLAS_GITHUB_APP_ID;
const originalPrivateKey = process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64;

afterEach(() => {
  if (originalAppId === undefined) {
    delete process.env.ATLAS_GITHUB_APP_ID;
  } else {
    process.env.ATLAS_GITHUB_APP_ID = originalAppId;
  }

  if (originalPrivateKey === undefined) {
    delete process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64;
  } else {
    process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64 = originalPrivateKey;
  }
});

describe('Atlas pull request evidence', () => {
  it('parses inline and list author assertions without inferring ordinary prose', () => {
    expect(
      parseAtlasPullRequestDirectives(`Implements the evidence viewer.

Atlas-Implements: atlas://plans/102-workstream-atlas-implementation-evidence
Atlas-Shapes:
- spec-workstream-atlas.implementation-evidence
- [Evidence Binding](spec-workstream-atlas.atlas-model.evidence-binding)

Completes the work.`),
    ).toEqual([
      {
        kind: 'implements',
        target: 'atlas://plans/102-workstream-atlas-implementation-evidence',
      },
      { kind: 'shapes', target: 'spec-workstream-atlas.implementation-evidence' },
      { kind: 'shapes', target: 'spec-workstream-atlas.atlas-model.evidence-binding' },
    ]);
  });

  it('loads only merged PRs carrying explicit Atlas directives', async () => {
    delete process.env.ATLAS_GITHUB_APP_ID;
    delete process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64;
    const fetcherMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      if (String(input).endsWith('/pulls/42')) {
        return Response.json({
          number: 42,
          title: 'Connect implementation evidence',
          body: 'Atlas-Shapes: product.reader',
          html_url: 'https://github.com/acme/product/pull/42',
          merged_at: '2026-09-01T10:00:00Z',
          merge_commit_sha: 'abc123',
          user: { login: 'javi', avatar_url: 'https://avatars.example/javi' },
          merged_by: { login: 'octo', avatar_url: 'https://avatars.example/octo' },
        });
      }

      return Response.json([
        {
          number: 42,
          title: 'Connect implementation evidence',
          body: 'Atlas-Shapes: product.reader',
          html_url: 'https://github.com/acme/product/pull/42',
          merged_at: '2026-09-01T10:00:00Z',
          merge_commit_sha: 'abc123',
          user: { login: 'javi', avatar_url: 'https://avatars.example/javi' },
        },
        {
          number: 41,
          title: 'Closed without merge',
          body: 'Atlas-Shapes: product.reader',
          html_url: 'https://github.com/acme/product/pull/41',
          merged_at: null,
          user: { login: 'javi' },
        },
        {
          number: 40,
          title: 'Ordinary merged PR',
          body: 'No Atlas assertions here.',
          html_url: 'https://github.com/acme/product/pull/40',
          merged_at: '2026-08-31T10:00:00Z',
          user: { login: 'javi' },
        },
      ]);
    });
    const fetcher = fetcherMock as typeof fetch;

    await expect(
      fetchAtlasPullRequestEvidence({
        fetcher,
        source: { sourceId: 'product', repositoryFullName: 'acme/product' },
      }),
    ).resolves.toEqual([
      {
        id: 'github:acme/product#42',
        sourceId: 'product',
        repositoryFullName: 'acme/product',
        number: 42,
        title: 'Connect implementation evidence',
        url: 'https://github.com/acme/product/pull/42',
        authorAvatarUrl: 'https://avatars.example/javi',
        authorLogin: 'javi',
        mergedByAvatarUrl: 'https://avatars.example/octo',
        mergedByLogin: 'octo',
        mergedAt: '2026-09-01T10:00:00Z',
        mergeCommitSha: 'abc123',
        directives: [{ kind: 'shapes', target: 'product.reader' }],
      },
    ]);
    expect(fetcherMock).toHaveBeenCalledTimes(2);
    expect(String(fetcherMock.mock.calls[0]?.[0])).toContain('/repos/acme/product/pulls');
    expect(fetcherMock.mock.calls[0]?.[1]).toMatchObject({
      next: { revalidate: 300, tags: ['atlas:github:acme/product'] },
    });
  });
});
