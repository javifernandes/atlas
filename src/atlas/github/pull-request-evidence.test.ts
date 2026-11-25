// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryReplicatedCollectionStorage } from '@ontahi/core';

import {
  fetchAtlasPullRequestEvidenceChanges,
  fetchAtlasPullRequestEvidence,
  loadAtlasPullRequestEvidenceObservation,
  parseAtlasPullRequestDirectives,
  githubEvidenceCollectionId,
  type AtlasPullRequestEvidenceReplicaStore,
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
          updated_at: '2026-09-02T10:00:00Z',
          merge_commit_sha: 'abc123',
          user: { id: 101, login: 'javi', avatar_url: 'https://avatars.example/javi' },
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
          updated_at: '2026-09-02T10:00:00Z',
          merge_commit_sha: 'abc123',
          user: { id: 101, login: 'javi', avatar_url: 'https://avatars.example/javi' },
        },
        {
          number: 41,
          title: 'Closed without merge',
          body: 'Atlas-Shapes: product.reader',
          html_url: 'https://github.com/acme/product/pull/41',
          merged_at: null,
          updated_at: '2026-09-01T09:00:00Z',
          user: { login: 'javi' },
        },
        {
          number: 40,
          title: 'Ordinary merged PR',
          body: 'No Atlas assertions here.',
          html_url: 'https://github.com/acme/product/pull/40',
          merged_at: '2026-08-31T10:00:00Z',
          updated_at: '2026-09-01T08:00:00Z',
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
        authorProviderAccountId: '101',
        authorLogin: 'javi',
        body: 'Atlas-Shapes: product.reader',
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

  it('observes an inclusive updated frontier and emits negative changes for removed directives', async () => {
    delete process.env.ATLAS_GITHUB_APP_ID;
    delete process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64;
    const page = Array.from({ length: 25 }, (_, index) => ({
      number: 100 - index,
      title: `PR ${100 - index}`,
      body: index === 0 ? 'No Atlas directives now.' : 'Atlas-Shapes: product.reader',
      html_url: `https://github.com/acme/product/pull/${100 - index}`,
      merged_at: '2026-09-01T10:00:00Z',
      updated_at: index < 2 ? '2026-09-02T10:00:00Z' : '2026-09-01T10:00:00Z',
      user: { login: 'javi' },
      merged_by: { login: 'octo' },
    }));
    const fetcherMock = vi.fn(async () => Response.json(page));

    const result = await fetchAtlasPullRequestEvidenceChanges({
      fetcher: fetcherMock as typeof fetch,
      frontier: '2026-09-02T10:00:00Z',
      source: { sourceId: 'product', repositoryFullName: 'acme/product' },
    });

    expect(fetcherMock).toHaveBeenCalledTimes(1);
    expect(result.frontier).toBe('2026-09-02T10:00:00.000Z');
    expect(result.changes[0]).toMatchObject({
      id: 'github:acme/product#100',
      pullRequest: null,
      updatedAt: '2026-09-02T10:00:00.000Z',
    });
    expect(result.changes[1]?.pullRequest?.number).toBe(99);
  });

  it('reuses the accepted replica and persists only the observed frontier window', async () => {
    delete process.env.ATLAS_GITHUB_APP_ID;
    delete process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64;
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'atlas-evidence-replica-'));
    await writeFile(
      path.join(repoRoot, 'package.json'),
      JSON.stringify({ repository: 'https://github.com/acme/atlas.git' }),
    );
    const cached = {
      authorAvatarUrl: null,
      authorProviderAccountId: '1',
      authorLogin: 'javi',
      body: 'Atlas-Shapes: product.reader',
      directives: [{ kind: 'shapes' as const, target: 'product.reader' }],
      id: 'github:acme/atlas#42',
      mergeCommitSha: 'abc123',
      mergedByAvatarUrl: null,
      mergedByLogin: 'javi',
      mergedAt: '2026-09-01T10:00:00Z',
      number: 42,
      repositoryFullName: 'acme/atlas',
      sourceId: 'atlas',
      title: 'Shape reader',
      url: 'https://github.com/acme/atlas/pull/42',
    };
    const collectionId = githubEvidenceCollectionId('acme/atlas');
    const replicaStore: AtlasPullRequestEvidenceReplicaStore =
      createInMemoryReplicatedCollectionStorage({
        [collectionId]: {
          frontier: '2026-09-02T10:00:00.000Z',
          records: [{ id: cached.id, record: cached }],
        },
      });

    try {
      const observation = await loadAtlasPullRequestEvidenceObservation({
        fetcher: vi.fn(async () => Response.json([
          {
            number: 42,
            title: 'Shape reader',
            body: 'Atlas-Shapes: product.reader',
            html_url: 'https://github.com/acme/atlas/pull/42',
            merged_at: '2026-09-01T10:00:00Z',
            updated_at: '2026-09-02T10:00:00Z',
            merge_commit_sha: 'abc123',
            user: { id: 1, login: 'javi' },
            merged_by: { login: 'javi' },
          },
        ])) as typeof fetch,
        replicaStore,
        repoRoot,
      });

      expect(observation).toMatchObject({
        failures: [],
        fetchedPullRequestCount: 1,
        reusedPullRequestCount: 1,
      });
      expect(observation.pullRequests).toHaveLength(1);
      expect(await replicaStore.load(collectionId)).toMatchObject({
        snapshot: { frontier: '2026-09-02T10:00:00.000Z' },
      });

      const failing = await loadAtlasPullRequestEvidenceObservation({
        fetcher: vi.fn(async () => new Response(null, { status: 503 })) as typeof fetch,
        replicaStore,
        repoRoot,
      });
      expect(failing.failures).toHaveLength(1);
      expect((await replicaStore.load(collectionId))?.snapshot.records).toHaveLength(1);

      const removed = await loadAtlasPullRequestEvidenceObservation({
        fetcher: vi.fn(async () => Response.json([{
          number: 42, updated_at: '2026-09-03T10:00:00Z', body: '',
        }])) as typeof fetch,
        replicaStore,
        repoRoot,
      });
      expect(removed).toMatchObject({ failures: [], changedPullRequestCount: 1, pullRequests: [] });
      expect((await replicaStore.load(collectionId))?.snapshot.records).toEqual([]);

      const noChange = await loadAtlasPullRequestEvidenceObservation({
        fetcher: vi.fn(async () => Response.json([])) as typeof fetch,
        replicaStore,
        repoRoot,
      });
      expect(noChange).toMatchObject({ failures: [], changedPullRequestCount: 0 });

      let startSlow!: () => void;
      let finishSlow!: (response: Response) => void;
      const slowStarted = new Promise<void>(resolve => { startSlow = resolve; });
      const slowResponse = new Promise<Response>(resolve => { finishSlow = resolve; });
      const slow = loadAtlasPullRequestEvidenceObservation({
        fetcher: async () => {
          startSlow();
          return slowResponse;
        },
        replicaStore,
        repoRoot,
      });
      await slowStarted;
      const fast = await loadAtlasPullRequestEvidenceObservation({
        fetcher: async () => Response.json([{ number: 42, updated_at: '2026-09-05T10:00:00Z' }]),
        replicaStore,
        repoRoot,
      });
      finishSlow(Response.json([{ number: 42, updated_at: '2026-09-04T10:00:00Z' }]));
      expect(fast.failures).toEqual([]);
      expect((await slow).failures).toHaveLength(1);
      expect((await replicaStore.load(collectionId))?.snapshot.frontier)
        .toBe('2026-09-05T10:00:00.000Z');
    } finally {
      await rm(repoRoot, { force: true, recursive: true });
    }
  });
});
