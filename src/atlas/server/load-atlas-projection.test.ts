import { describe, expect, it } from 'vitest';

import type { AtlasLoadedSourceRevision } from '../sources/markdown-source';
import type { NormalizedAtlasSourceRecord } from '../sources/normalized-source';
import { composeIncrementalSourceProjection } from './load-atlas-projection';

const revision = (sourceId: string, value: string): AtlasLoadedSourceRevision => ({
  authority: 'markdown',
  id: `${sourceId}:markdown:${value}`,
  observedAt: '2026-11-17T00:00:00.000Z',
  repository: `acme/${sourceId}`,
  revision: value,
  revisionKind: 'git',
  sourceId,
});

const record = (
  sourceId: string,
  sourcePath: string,
  content: string,
): NormalizedAtlasSourceRecord => ({
  canonicalPath: `${sourceId}://${sourcePath}`,
  content,
  sourceId,
  sourcePath,
});

describe('incremental Atlas source projection', () => {
  it('replaces the changed source while retaining unchanged source records and lineage', () => {
    const result = composeIncrementalSourceProjection({
      baseline: {
        projectionRevisionId: 'projection:1',
        records: [
          record('atlas', 'plans/current/1-atlas.md', '# Atlas'),
          record('product', 'plans/current/2-old.md', '# Old'),
          record('platform', 'plans/current/3-platform.md', '# Platform'),
        ],
        sourceRevisions: [
          revision('atlas', 'atlas-1'),
          revision('product', 'product-1'),
          revision('platform', 'platform-1'),
        ],
      },
      changedRecords: [record('product', 'plans/current/2-new.md', '# New')],
      changedSourceRevisions: [revision('product', 'product-2')],
    });

    expect(result.records).toEqual([
      record('atlas', 'plans/current/1-atlas.md', '# Atlas'),
      record('platform', 'plans/current/3-platform.md', '# Platform'),
      record('product', 'plans/current/2-new.md', '# New'),
    ]);
    expect(result.sourceRevisions).toEqual([
      revision('atlas', 'atlas-1'),
      revision('platform', 'platform-1'),
      revision('product', 'product-2'),
    ]);
  });

  it('removes changed-source records that disappeared from the fresh observation', () => {
    const result = composeIncrementalSourceProjection({
      baseline: {
        projectionRevisionId: 'projection:1',
        records: [
          record('product', 'plans/current/kept.md', '# Kept before'),
          record('product', 'plans/current/deleted.md', '# Deleted'),
          record('atlas', 'plans/current/atlas.md', '# Atlas'),
        ],
        sourceRevisions: [revision('product', 'product-1'), revision('atlas', 'atlas-1')],
      },
      changedRecords: [record('product', 'plans/current/kept.md', '# Kept after')],
      changedSourceRevisions: [revision('product', 'product-2')],
    });

    expect(result.records).toEqual([
      record('atlas', 'plans/current/atlas.md', '# Atlas'),
      record('product', 'plans/current/kept.md', '# Kept after'),
    ]);
  });
});
