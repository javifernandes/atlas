import { describe, expect, it, vi } from 'vitest';

import { createVersionedProjectionSnapshotCache } from './projection-snapshot-cache';

describe('versioned projection snapshot cache', () => {
  it('reuses an unchanged full snapshot and reloads after revision changes or invalidation', async () => {
    let revisionId = 'projection:1';
    let snapshotVersion = 1;
    const readRevisionId = vi.fn(async () => revisionId);
    const readSnapshot = vi.fn(async () => ({ version: snapshotVersion }));
    const cache = createVersionedProjectionSnapshotCache({ readRevisionId, readSnapshot });

    await expect(cache.read()).resolves.toEqual({ version: 1 });
    await expect(cache.read()).resolves.toEqual({ version: 1 });
    expect(readRevisionId).toHaveBeenCalledTimes(2);
    expect(readSnapshot).toHaveBeenCalledOnce();

    revisionId = 'projection:2';
    snapshotVersion = 2;
    await expect(cache.read()).resolves.toEqual({ version: 2 });
    expect(readSnapshot).toHaveBeenCalledTimes(2);

    cache.invalidate();
    snapshotVersion = 3;
    await expect(cache.read()).resolves.toEqual({ version: 3 });
    expect(readSnapshot).toHaveBeenCalledTimes(3);
  });

  it('does not repopulate stale state when invalidated during a read', async () => {
    let releaseSnapshot: ((snapshot: { version: number }) => void) | undefined;
    const readSnapshot = vi.fn(
      () =>
        new Promise<{ version: number }>(resolve => {
          releaseSnapshot = resolve;
        }),
    );
    const cache = createVersionedProjectionSnapshotCache({
      readRevisionId: async () => 'projection:1',
      readSnapshot,
    });

    const firstRead = cache.read();
    await vi.waitFor(() => expect(readSnapshot).toHaveBeenCalledOnce());
    cache.invalidate();
    releaseSnapshot?.({ version: 1 });
    await expect(firstRead).resolves.toEqual({ version: 1 });

    const secondRead = cache.read();
    await vi.waitFor(() => expect(readSnapshot).toHaveBeenCalledTimes(2));
    releaseSnapshot?.({ version: 2 });
    await expect(secondRead).resolves.toEqual({ version: 2 });
  });
});
