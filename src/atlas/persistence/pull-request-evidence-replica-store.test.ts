// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import type { AtlasObservedPullRequest } from '../github/pull-request-evidence';
import { createAtlasPullRequestEvidenceReplicaStore } from './pull-request-evidence-replica-store';

const source = { sourceId: 'atlas', repositoryFullName: 'acme/atlas' };
const pullRequest: AtlasObservedPullRequest = {
  authorAvatarUrl: null,
  authorProviderAccountId: '1',
  authorLogin: 'javi',
  body: 'Atlas-Shapes: product.reader',
  directives: [{ kind: 'shapes', target: 'product.reader' }],
  id: 'github:acme/atlas#42',
  mergeCommitSha: 'abc123',
  mergedByAvatarUrl: null,
  mergedByLogin: 'javi',
  mergedAt: '2026-11-23T10:00:00Z',
  number: 42,
  repositoryFullName: 'acme/atlas',
  sourceId: 'atlas',
  title: 'Shape reader',
  url: 'https://github.com/acme/atlas/pull/42',
};

describe('Atlas Pull Request evidence replica store', () => {
  it('hydrates one repeatable-read snapshot and normalizes the provider frontier', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM atlas_github_evidence_frontiers')) {
        return { rows: [{ provider_updated_at: new Date('2026-11-24T01:00:00Z') }] };
      }
      if (sql.includes('FROM atlas_github_pull_request_evidence_replica')) {
        return { rows: [{ payload_json: pullRequest }] };
      }
      return { rows: [] };
    });
    const release = vi.fn();
    const store = createAtlasPullRequestEvidenceReplicaStore({
      connect: async () => ({ query, release }) as never,
    });

    await expect(store.load(source)).resolves.toEqual({
      frontier: '2026-11-24T01:00:00.000Z',
      pullRequests: [pullRequest],
    });
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
      expect.stringContaining('FROM atlas_github_evidence_frontiers'),
      expect.stringContaining('FROM atlas_github_pull_request_evidence_replica'),
      'COMMIT',
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('atomically applies positive and negative observations before advancing the frontier', async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] }));
    const store = createAtlasPullRequestEvidenceReplicaStore({
      connect: async () => ({ query, release: vi.fn() }) as never,
    });

    await store.save({
      changes: [
        { id: pullRequest.id, pullRequest, updatedAt: '2026-11-24T01:00:00Z' },
        { id: 'github:acme/atlas#41', pullRequest: null, updatedAt: '2026-11-23T01:00:00Z' },
      ],
      frontier: '2026-11-24T01:00:00Z',
      source,
    });

    expect(query.mock.calls.map(([sql]) => sql.trim().split(/\s+/).slice(0, 3).join(' '))).toEqual([
      'BEGIN',
      'INSERT INTO atlas_github_pull_request_evidence_replica',
      'DELETE FROM atlas_github_pull_request_evidence_replica',
      'INSERT INTO atlas_github_evidence_frontiers',
      'COMMIT',
    ]);
  });
});
