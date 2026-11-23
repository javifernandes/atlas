import { createReplicatedVersionedMaterializerRunner } from '@ontahi/core';
import { describe, expect, it, vi } from 'vitest';

import {
  normalizeAtlasSourceRecord,
  type NormalizedAtlasSourceRecord,
} from '../sources/normalized-source';
import {
  atlasSourceRef,
  deriveAtlasSourceChangeSet,
  type AtlasSourceRevisionRef,
} from '../sources/source-changeset';
import { parseAtlasSourceRecords } from './build-snapshot';
import {
  assembleParsedAtlasSourceRecordArtifacts,
  deserializeParsedAtlasSourceRecordArtifact,
  parseAtlasSourceRecordArtifact,
} from './parsed-record-artifact';
import { createAtlasParsedRecordMaterializer } from './parsed-record-materializer';

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

const changeSet = (
  baseRecords: NormalizedAtlasSourceRecord[],
  targetRecords: NormalizedAtlasSourceRecord[],
  base: string,
  target: string,
) =>
  deriveAtlasSourceChangeSet({
    baseRecords,
    baseRevision: revision(base),
    observedAt: '2026-11-21T00:00:00.000Z',
    targetRecords,
    targetRevision: revision(target),
  });

describe('Atlas parsed record Materializer', () => {
  it('reparses only the record affected by an exact Source ChangeSet', async () => {
    const parseRecord = vi.fn(parseAtlasSourceRecordArtifact);
    const runner = createReplicatedVersionedMaterializerRunner(
      createAtlasParsedRecordMaterializer({ parseRecord }),
    );
    const baseRecords = [
      record('atlas/items/one.md', 'One', 'base'),
      record('atlas/items/two.md', 'Two', 'base'),
    ];
    const rebuilt = await runner.run({
      mode: 'rebuild',
      input: { artifacts: [], records: baseRecords },
      sourceFrontier: 'git:base',
    });
    const targetRecords = [
      record('atlas/items/one.md', 'Updated one', 'target'),
      record('atlas/items/two.md', 'Two', 'target'),
    ];

    parseRecord.mockClear();
    const incremental = await runner.run({
      mode: 'incremental',
      input: { artifacts: rebuilt.output?.artifacts ?? [], records: targetRecords },
      delta: changeSet(baseRecords, targetRecords, 'base', 'target'),
      baseSourceFrontier: 'git:base',
      sourceFrontier: 'git:target',
    });

    expect(incremental.result).toMatchObject({ status: 'accepted', replayed: false });
    expect(parseRecord).toHaveBeenCalledOnce();
    expect(parseRecord).toHaveBeenCalledWith(targetRecords[0]);
    expect(incremental.output?.changes).toEqual([
      expect.objectContaining({
        operation: 'set',
        sourceRecordIdentity: 'atlas://atlas/one',
      }),
    ]);
    expect(
      assembleParsedAtlasSourceRecordArtifacts({
        artifacts: (incremental.output?.artifacts ?? []).map(
          deserializeParsedAtlasSourceRecordArtifact,
        ),
        records: targetRecords,
      }),
    ).toEqual(parseAtlasSourceRecords(targetRecords));

    parseRecord.mockClear();
    await runner.run({
      mode: 'rebuild',
      input: { artifacts: incremental.output?.artifacts ?? [], records: targetRecords },
      sourceFrontier: 'git:repair',
    });
    expect(parseRecord).toHaveBeenCalledTimes(targetRecords.length);
  });

  it('handles create, delete, and move while preserving full-parser equivalence', async () => {
    const runner = createReplicatedVersionedMaterializerRunner(
      createAtlasParsedRecordMaterializer(),
    );
    const baseRecords = [
      record('atlas/items/delete.md', 'Delete', 'base'),
      record('atlas/items/move-from.md', 'Move', 'base'),
      record('atlas/items/stable.md', 'Stable', 'base'),
    ];
    const rebuilt = await runner.run({
      mode: 'rebuild',
      input: { artifacts: [], records: baseRecords },
      sourceFrontier: 'git:base',
    });
    const targetRecords = [
      record('atlas/items/create.md', 'Create', 'target'),
      record('atlas/items/move-to.md', 'Move', 'target'),
      record('atlas/items/stable.md', 'Stable', 'target'),
    ];
    const incremental = await runner.run({
      mode: 'incremental',
      input: { artifacts: rebuilt.output?.artifacts ?? [], records: targetRecords },
      delta: changeSet(baseRecords, targetRecords, 'base', 'target'),
      baseSourceFrontier: 'git:base',
      sourceFrontier: 'git:target',
    });

    expect(incremental.result).toMatchObject({ status: 'accepted' });
    expect(incremental.output?.changes).toEqual(
      expect.arrayContaining([
        { operation: 'delete', sourceRecordIdentity: 'atlas://atlas/delete' },
        { operation: 'delete', sourceRecordIdentity: 'atlas://atlas/move-from' },
        expect.objectContaining({
          operation: 'set',
          sourceRecordIdentity: 'atlas://atlas/create',
        }),
        expect.objectContaining({
          operation: 'set',
          sourceRecordIdentity: 'atlas://atlas/move-to',
        }),
      ]),
    );
    expect(
      assembleParsedAtlasSourceRecordArtifacts({
        artifacts: (incremental.output?.artifacts ?? []).map(
          deserializeParsedAtlasSourceRecordArtifact,
        ),
        records: targetRecords,
      }),
    ).toEqual(parseAtlasSourceRecords(targetRecords));
  });

  it('requests a rebuild when a removal has no dependency evidence', async () => {
    const materializer = createAtlasParsedRecordMaterializer();
    const runner = createReplicatedVersionedMaterializerRunner(materializer, {
      initial: {
        snapshot: {
          acceptance: {
            acceptedFrontier: 'atlas-parsed-records:empty',
            derivationId: materializer.id,
            materializerVersion: materializer.version,
            sourceFrontier: 'git:base',
          },
          state: { artifactIds: [] },
        },
        dependencies: [],
      },
    });
    const baseRecords = [record('atlas/items/delete.md', 'Delete', 'base')];
    const delta = changeSet(baseRecords, [], 'base', 'target');

    await expect(
      runner.run({
        mode: 'incremental',
        input: { artifacts: [], records: [] },
        delta,
        baseSourceFrontier: 'git:base',
        sourceFrontier: 'git:target',
      }),
    ).resolves.toEqual({
      result: {
        accepted: runner.current()?.acceptance,
        reason: 'unknown-dependency',
        status: 'rebuild-required',
      },
      output: null,
    });
  });
});
