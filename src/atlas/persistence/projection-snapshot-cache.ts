export type VersionedProjectionSnapshotCache<TSnapshot> = {
  invalidate: () => void;
  read: () => Promise<TSnapshot | null>;
};

export const createVersionedProjectionSnapshotCache = <TSnapshot>(input: {
  readRevisionId: () => Promise<string | null>;
  readSnapshot: () => Promise<TSnapshot | null>;
}): VersionedProjectionSnapshotCache<TSnapshot> => {
  let cached: { revisionId: string; snapshot: TSnapshot } | null = null;
  let generation = 0;
  let pending: { revisionId: string; snapshot: Promise<TSnapshot | null> } | null = null;

  const invalidate = () => {
    generation += 1;
    cached = null;
    pending = null;
  };

  const read = async () => {
    const revisionId = await input.readRevisionId();

    if (!revisionId) {
      cached = null;
      return null;
    }

    if (cached?.revisionId === revisionId) {
      return cached.snapshot;
    }

    if (pending?.revisionId === revisionId) {
      return pending.snapshot;
    }

    const readGeneration = generation;
    const snapshot = input.readSnapshot().then(value => {
      if (value && generation === readGeneration) {
        cached = { revisionId, snapshot: value };
      }

      return value;
    });
    pending = { revisionId, snapshot };

    try {
      return await snapshot;
    } finally {
      if (pending?.snapshot === snapshot) {
        pending = null;
      }
    }
  };

  return { invalidate, read };
};
