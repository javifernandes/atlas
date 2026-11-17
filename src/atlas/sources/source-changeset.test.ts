import { describe, expect, it } from 'vitest';

import type { NormalizedAtlasSourceRecord } from './normalized-source';
import {
  applyAtlasSourceChangeSet,
  atlasSourceRef,
  deriveAtlasSourceChangeSet,
  type AtlasSourceRevisionRef,
} from './source-changeset';

const record = (sourcePath: string, content: string): NormalizedAtlasSourceRecord => ({
  canonicalPath: `product://${sourcePath}`,
  content,
  sourceId: 'product',
  sourcePath,
});

const revision = (revisionKey: string): AtlasSourceRevisionRef => ({
  revisionKey,
  revisionScheme: 'git',
  source: atlasSourceRef('product'),
});

describe('Source ChangeSet runtime', () => {
  it('derives and applies create, update, delete, and filesystem move operations', () => {
    const baseRecords = [
      record('plans/updated.md', '# Before'),
      record('plans/deleted.md', '# Deleted'),
      record('plans/move-from.md', '# Moved'),
    ];
    const targetRecords = [
      record('plans/updated.md', '# After'),
      record('plans/created.md', '# Created'),
      record('plans/move-to.md', '# Moved'),
    ];
    const changeSet = deriveAtlasSourceChangeSet({
      baseRecords,
      baseRevision: revision('base'),
      observedAt: '2026-11-17T01:00:00.000Z',
      providerDeliveryId: 'delivery-1',
      targetRecords,
      targetRevision: revision('target'),
    });

    expect(changeSet.operations.map(operation => operation.kind).sort()).toEqual([
      'create',
      'delete',
      'move',
      'update',
    ]);
    expect(
      applyAtlasSourceChangeSet({ changeSet, currentRevision: revision('base'), records: baseRecords }),
    ).toEqual({
      records: [...targetRecords].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath)),
      revision: revision('target'),
      status: 'applied',
    });
  });

  it('is idempotent at the target revision and rejects a mismatched base', () => {
    const baseRecords = [record('plans/a.md', '# A')];
    const targetRecords = [record('plans/a.md', '# B')];
    const changeSet = deriveAtlasSourceChangeSet({
      baseRecords,
      baseRevision: revision('base'),
      observedAt: '2026-11-17T01:00:00.000Z',
      targetRecords,
      targetRevision: revision('target'),
    });

    expect(
      applyAtlasSourceChangeSet({ changeSet, currentRevision: revision('target'), records: targetRecords }),
    ).toMatchObject({ status: 'duplicate', records: targetRecords });
    expect(
      applyAtlasSourceChangeSet({ changeSet, currentRevision: revision('other'), records: baseRecords }),
    ).toMatchObject({
      status: 'base-mismatch',
      actualRevision: revision('other'),
      expectedRevision: revision('base'),
    });
  });

  it('produces stable identity independent from record input order', () => {
    const input = {
      baseRecords: [record('plans/a.md', '# A'), record('plans/b.md', '# B')],
      baseRevision: revision('base'),
      observedAt: '2026-11-17T01:00:00.000Z',
      targetRecords: [record('plans/a.md', '# A2'), record('plans/c.md', '# C')],
      targetRevision: revision('target'),
    };

    expect(deriveAtlasSourceChangeSet(input).id).toBe(
      deriveAtlasSourceChangeSet({
        ...input,
        baseRecords: [...input.baseRecords].reverse(),
        targetRecords: [...input.targetRecords].reverse(),
      }).id,
    );
  });

  it('chooses filesystem moves deterministically when deleted files share content', () => {
    const input = {
      baseRecords: [record('plans/b.md', '# Same'), record('plans/a.md', '# Same')],
      baseRevision: revision('base'),
      observedAt: '2026-11-17T01:00:00.000Z',
      targetRecords: [record('plans/c.md', '# Same')],
      targetRevision: revision('target'),
    };
    const forward = deriveAtlasSourceChangeSet(input);
    const reverse = deriveAtlasSourceChangeSet({
      ...input,
      baseRecords: [...input.baseRecords].reverse(),
    });

    expect(forward.id).toBe(reverse.id);
    expect(forward.operations).toEqual(reverse.operations);
    expect(forward.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'move', from: 'plans/a.md', to: 'plans/c.md' }),
        expect.objectContaining({ kind: 'delete', path: 'plans/b.md' }),
      ]),
    );
  });
});
