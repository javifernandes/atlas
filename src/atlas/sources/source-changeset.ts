import { createHash } from 'node:crypto';

import { createEntityRef, type EntityRef } from '@ontahi/core';

import type { NormalizedAtlasSourceRecord } from './normalized-source';

export type AtlasSourceRef = EntityRef<'AtlasSource', { id: string }>;

export type AtlasSourceRevisionRef = {
  revisionKey: string;
  revisionScheme: 'content-sha256' | 'git';
  source: AtlasSourceRef;
};

type SourceRecordOperationBase = {
  contentHash: string;
};

export type AtlasSourceOperation =
  | (SourceRecordOperationBase & {
      kind: 'create';
      path: string;
      record: NormalizedAtlasSourceRecord;
    })
  | (SourceRecordOperationBase & {
      kind: 'update';
      path: string;
      previousContentHash: string;
      record: NormalizedAtlasSourceRecord;
    })
  | (SourceRecordOperationBase & {
      kind: 'delete';
      path: string;
    })
  | (SourceRecordOperationBase & {
      kind: 'move';
      from: string;
      to: string;
      record: NormalizedAtlasSourceRecord;
    });

export type AtlasSourceChangeSet = {
  id: string;
  source: AtlasSourceRef;
  baseRevision: AtlasSourceRevisionRef;
  targetRevision: AtlasSourceRevisionRef;
  operations: AtlasSourceOperation[];
  provenance: {
    provider: 'github';
    providerDeliveryId: string | null;
    observedAt: string;
  };
  attribution: {
    principalId: string | null;
    sessionId: string | null;
    unitOfWorkId: string | null;
  };
};

export type AtlasSourceChangeSetApplication =
  | {
      status: 'applied';
      records: NormalizedAtlasSourceRecord[];
      revision: AtlasSourceRevisionRef;
    }
  | {
      status: 'duplicate';
      records: NormalizedAtlasSourceRecord[];
      revision: AtlasSourceRevisionRef;
    }
  | {
      status: 'base-mismatch';
      actualRevision: AtlasSourceRevisionRef;
      expectedRevision: AtlasSourceRevisionRef;
    };

export const atlasSourceRef = (sourceId: string): AtlasSourceRef =>
  createEntityRef('AtlasSource', { id: sourceId });

const contentHash = (content: string) =>
  createHash('sha256').update(content).digest('hex');

const sourceIdFromRef = (source: AtlasSourceRef) => String(source.locator.id);

const assertRecordSet = (sourceId: string, records: NormalizedAtlasSourceRecord[]) => {
  const paths = new Set<string>();

  for (const record of records) {
    if ((record.sourceId ?? 'atlas') !== sourceId) {
      throw new Error(`Source ${sourceId} cannot contain record from ${record.sourceId ?? 'atlas'}.`);
    }
    if (paths.has(record.sourcePath)) {
      throw new Error(`Source ${sourceId} contains duplicate path ${record.sourcePath}.`);
    }
    paths.add(record.sourcePath);
  }
};

const stableOperationValue = (operation: AtlasSourceOperation) => {
  if (operation.kind === 'move') {
    return `${operation.kind}\0${operation.from}\0${operation.to}\0${operation.contentHash}`;
  }

  return `${operation.kind}\0${operation.path}\0${operation.contentHash}`;
};

export const deriveAtlasSourceChangeSet = (input: {
  attribution?: Partial<AtlasSourceChangeSet['attribution']>;
  baseRecords: NormalizedAtlasSourceRecord[];
  baseRevision: AtlasSourceRevisionRef;
  observedAt: string;
  providerDeliveryId?: string | null;
  targetRecords: NormalizedAtlasSourceRecord[];
  targetRevision: AtlasSourceRevisionRef;
}): AtlasSourceChangeSet => {
  const sourceId = sourceIdFromRef(input.targetRevision.source);
  if (sourceIdFromRef(input.baseRevision.source) !== sourceId) {
    throw new Error('A Source ChangeSet cannot cross Source identities.');
  }
  assertRecordSet(sourceId, input.baseRecords);
  assertRecordSet(sourceId, input.targetRecords);

  const baseRecords = [...input.baseRecords].sort((left, right) =>
    left.sourcePath.localeCompare(right.sourcePath),
  );
  const targetRecords = [...input.targetRecords].sort((left, right) =>
    left.sourcePath.localeCompare(right.sourcePath),
  );
  const baseByPath = new Map(baseRecords.map(record => [record.sourcePath, record]));
  const targetByPath = new Map(targetRecords.map(record => [record.sourcePath, record]));
  const deleted = baseRecords.filter(record => !targetByPath.has(record.sourcePath));
  const created = targetRecords.filter(record => !baseByPath.has(record.sourcePath));
  const createdByHash = new Map<string, NormalizedAtlasSourceRecord[]>();

  for (const record of created) {
    const hash = contentHash(record.content);
    createdByHash.set(hash, [...(createdByHash.get(hash) ?? []), record]);
  }

  const movedTargetPaths = new Set<string>();
  const movedSourcePaths = new Set<string>();
  const operations: AtlasSourceOperation[] = [];

  for (const record of deleted) {
    const hash = contentHash(record.content);
    const candidates = createdByHash.get(hash) ?? [];
    if (candidates.length !== 1) continue;
    const target = candidates[0]!;
    if (movedTargetPaths.has(target.sourcePath)) continue;

    movedSourcePaths.add(record.sourcePath);
    movedTargetPaths.add(target.sourcePath);
    operations.push({
      kind: 'move',
      from: record.sourcePath,
      to: target.sourcePath,
      contentHash: hash,
      record: target,
    });
  }

  for (const record of baseRecords) {
    const target = targetByPath.get(record.sourcePath);
    if (!target || record.content === target.content) continue;
    operations.push({
      kind: 'update',
      path: record.sourcePath,
      previousContentHash: contentHash(record.content),
      contentHash: contentHash(target.content),
      record: target,
    });
  }

  for (const record of deleted) {
    if (movedSourcePaths.has(record.sourcePath)) continue;
    operations.push({
      kind: 'delete',
      path: record.sourcePath,
      contentHash: contentHash(record.content),
    });
  }

  for (const record of created) {
    if (movedTargetPaths.has(record.sourcePath)) continue;
    operations.push({
      kind: 'create',
      path: record.sourcePath,
      contentHash: contentHash(record.content),
      record,
    });
  }

  operations.sort((left, right) => stableOperationValue(left).localeCompare(stableOperationValue(right)));
  const id = `source-change-set:${createHash('sha256')
    .update(
      [
        sourceId,
        input.baseRevision.revisionScheme,
        input.baseRevision.revisionKey,
        input.targetRevision.revisionScheme,
        input.targetRevision.revisionKey,
        ...operations.map(stableOperationValue),
      ].join('\0'),
    )
    .digest('hex')}`;

  return {
    id,
    source: input.targetRevision.source,
    baseRevision: input.baseRevision,
    targetRevision: input.targetRevision,
    operations,
    provenance: {
      observedAt: input.observedAt,
      provider: 'github',
      providerDeliveryId: input.providerDeliveryId ?? null,
    },
    attribution: {
      principalId: input.attribution?.principalId ?? null,
      sessionId: input.attribution?.sessionId ?? null,
      unitOfWorkId: input.attribution?.unitOfWorkId ?? null,
    },
  };
};

const revisionsEqual = (left: AtlasSourceRevisionRef, right: AtlasSourceRevisionRef) =>
  sourceIdFromRef(left.source) === sourceIdFromRef(right.source) &&
  left.revisionScheme === right.revisionScheme &&
  left.revisionKey === right.revisionKey;

export const applyAtlasSourceChangeSet = (input: {
  changeSet: AtlasSourceChangeSet;
  currentRevision: AtlasSourceRevisionRef;
  records: NormalizedAtlasSourceRecord[];
}): AtlasSourceChangeSetApplication => {
  if (revisionsEqual(input.currentRevision, input.changeSet.targetRevision)) {
    return { status: 'duplicate', records: input.records, revision: input.currentRevision };
  }
  if (!revisionsEqual(input.currentRevision, input.changeSet.baseRevision)) {
    return {
      status: 'base-mismatch',
      actualRevision: input.currentRevision,
      expectedRevision: input.changeSet.baseRevision,
    };
  }

  const sourceId = sourceIdFromRef(input.changeSet.source);
  assertRecordSet(sourceId, input.records);
  const records = new Map(input.records.map(record => [record.sourcePath, record]));

  for (const operation of input.changeSet.operations) {
    if (operation.kind === 'create') {
      if (records.has(operation.path)) throw new Error(`Cannot create existing path ${operation.path}.`);
      records.set(operation.path, operation.record);
      continue;
    }

    const sourcePath = operation.kind === 'move' ? operation.from : operation.path;
    const previous = records.get(sourcePath);
    if (!previous || contentHash(previous.content) !== (operation.kind === 'update'
      ? operation.previousContentHash
      : operation.contentHash)) {
      throw new Error(`Source ChangeSet precondition failed for ${sourcePath}.`);
    }

    if (operation.kind === 'delete') {
      records.delete(operation.path);
    } else if (operation.kind === 'update') {
      records.set(operation.path, operation.record);
    } else {
      if (records.has(operation.to)) throw new Error(`Cannot move into existing path ${operation.to}.`);
      records.delete(operation.from);
      records.set(operation.to, operation.record);
    }
  }

  return {
    status: 'applied',
    records: [...records.values()].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath)),
    revision: input.changeSet.targetRevision,
  };
};
