import { describe, expect, it, vi } from 'vitest';

import {
  backfillAtlasWorkspaceSourceInstallations,
  backfillCanonicalAtlasWorkspaceOwner,
  backfillCanonicalAtlasWorkspaceProjection,
} from './backfill-source-installations';

describe('Workspace Source installation backfill', () => {
  it('reconciles the oldest Atlas User as canonical Workspace owner', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ user_id: 'user-1' }] });

    await expect(backfillCanonicalAtlasWorkspaceOwner({
      pool: { query } as never,
    })).resolves.toEqual({ ownerAssigned: true });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), [
      '00000000-0000-4000-8000-000000000137',
    ]);
  });

  it('resolves and persists installation authority for legacy Sources', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'source-1', repository: 'acme/product' }] })
      .mockResolvedValueOnce({ rows: [] });
    const resolveInstallationId = vi.fn().mockResolvedValue('installation-42');

    await expect(backfillAtlasWorkspaceSourceInstallations({
      pool: { query } as never,
      resolveInstallationId,
    })).resolves.toEqual({ inspected: 1, updated: 1 });
    expect(resolveInstallationId).toHaveBeenCalledWith('acme/product');
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('UPDATE'), [
      'installation-42',
      'source-1',
    ]);
  });

  it('fails closed when a configured Source is outside the App installation', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: 'source-1', repository: 'acme/private' }],
    });
    await expect(backfillAtlasWorkspaceSourceInstallations({
      pool: { query } as never,
      resolveInstallationId: () => Promise.resolve(null),
    })).rejects.toThrow('acme/private');
  });

  it('publishes the canonical Workspace projection once', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ missing: true }] })
        .mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ exists: false }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'workspace-source-1',
            sourceId: 'atlas',
            repository: 'acme/atlas',
            ref: 'main',
          }],
        }),
    };
    const reconcile = vi.fn().mockResolvedValue({
      observedAt: '2026-11-07T00:00:00.000Z',
      snapshot: { documents: [], edges: [], metrics: [], nodes: [], territories: [] },
      sourceRevisionSetHash: 'revision-set',
      sourceRevisions: [],
    });

    await expect(backfillCanonicalAtlasWorkspaceProjection({
      pool: pool as never,
      reconcile,
    })).resolves.toEqual({ created: true, sourceCount: 1 });
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({
      sources: [{ id: 'atlas', repository: 'acme/atlas', ref: 'main' }],
    }));
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('leaves an existing canonical Workspace projection untouched', async () => {
    const pool = {
      connect: vi.fn(),
      query: vi.fn().mockResolvedValue({ rows: [{ exists: true }] }),
    };

    await expect(backfillCanonicalAtlasWorkspaceProjection({
      pool: pool as never,
      reconcile: vi.fn(),
    })).resolves.toEqual({ created: false, sourceCount: 0 });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
