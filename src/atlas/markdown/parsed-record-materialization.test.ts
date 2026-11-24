import { describe, expect, it, vi } from 'vitest';

import { normalizeAtlasSourceRecord } from '../sources/normalized-source';
import {
  atlasSourceRef,
  deriveAtlasSourceChangeSet,
  type AtlasSourceRevisionRef,
} from '../sources/source-changeset';
import { parseAtlasSourceRecords } from './build-snapshot';
import { parseAtlasSourceRecordArtifact } from './parsed-record-artifact';
import { materializeAtlasParsedRecords } from './parsed-record-materialization';

const record = (path: string, title: string, revision: string) =>
  normalizeAtlasSourceRecord({
    path,
    source: 'atlas',
    sourceRevision: revision,
    sourceRevisionKind: 'git',
    content: `---
id: atlas.${path.replaceAll(/[^a-z0-9]+/gi, '-')}
kind: capability
title: ${title}
status: shaping
---
`,
  });

const revision = (revisionKey: string): AtlasSourceRevisionRef => ({
  revisionKey,
  revisionScheme: 'git',
  source: atlasSourceRef('atlas'),
});

const loadedRevision = (value: string) => ({
  authority: 'markdown' as const,
  id: `atlas:markdown:${value}`,
  observedAt: '2026-11-23T00:00:00.000Z',
  repository: 'javifernandes/atlas',
  revision: value,
  revisionKind: 'git' as const,
  sourceId: 'atlas',
});

describe('Atlas parsed-record materialization', () => {
  it('hydrates a prior process and reparses only the changed record', async () => {
    const baseRecords = [
      record('atlas/items/one.md', 'One', 'base'),
      record('atlas/items/two.md', 'Two', 'base'),
    ];
    const rebuilt = await materializeAtlasParsedRecords({
      records: baseRecords,
      sourceRevisions: [loadedRevision('base')],
    });
    const targetRecords = [
      record('atlas/items/one.md', 'Updated one', 'target'),
      record('atlas/items/two.md', 'Two', 'target'),
    ];
    const parseRecord = vi.fn(parseAtlasSourceRecordArtifact);
    const incremental = await materializeAtlasParsedRecords({
      changeSet: deriveAtlasSourceChangeSet({
        baseRecords,
        baseRevision: revision('base'),
        observedAt: '2026-11-23T00:00:00.000Z',
        targetRecords,
        targetRevision: revision('target'),
      }),
      initial: rebuilt,
      parseRecord,
      records: targetRecords,
      sourceRevisions: [loadedRevision('target')],
    });

    expect(incremental).toMatchObject({
      fallbackReason: null,
      mode: 'incremental',
      parsedRecordCount: 1,
      reusedRecordCount: 1,
    });
    expect(parseRecord).toHaveBeenCalledOnce();
    expect(parseRecord).toHaveBeenCalledWith(targetRecords[0]);
    expect(incremental.source).toEqual(parseAtlasSourceRecords(targetRecords));
  });

  it('falls back to a full rebuild when the durable checkpoint is behind the Source baseline', async () => {
    const oldRecords = [record('atlas/items/one.md', 'Old', 'old')];
    const oldCheckpoint = await materializeAtlasParsedRecords({
      records: oldRecords,
      sourceRevisions: [loadedRevision('old')],
    });
    const baseRecords = [record('atlas/items/one.md', 'Base', 'base')];
    const targetRecords = [record('atlas/items/one.md', 'Target', 'target')];
    const parseRecord = vi.fn(parseAtlasSourceRecordArtifact);
    const result = await materializeAtlasParsedRecords({
      changeSet: deriveAtlasSourceChangeSet({
        baseRecords,
        baseRevision: revision('base'),
        observedAt: '2026-11-23T00:00:00.000Z',
        targetRecords,
        targetRevision: revision('target'),
      }),
      initial: oldCheckpoint,
      parseRecord,
      records: targetRecords,
      sourceRevisions: [loadedRevision('target')],
    });

    expect(result).toMatchObject({
      fallbackReason: 'source-frontier-gap',
      mode: 'rebuild',
      parsedRecordCount: 1,
      reusedRecordCount: 0,
    });
    expect(parseRecord).toHaveBeenCalledOnce();
    expect(result.source).toEqual(parseAtlasSourceRecords(targetRecords));
  });
});
