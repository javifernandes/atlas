import { createHash } from 'node:crypto';

import type { Materializer, MaterializerDependency } from '@ontahi/core';

import type { NormalizedAtlasSourceRecord } from '../sources/normalized-source';
import type { AtlasSourceChangeSet, AtlasSourceOperation } from '../sources/source-changeset';
import {
  atlasParsedRecordContentHash,
  ATLAS_PARSED_RECORD_MATERIALIZER_ID,
  ATLAS_PARSED_RECORD_MATERIALIZER_VERSION,
  parseAtlasSourceRecordArtifact,
  serializeParsedAtlasSourceRecordArtifact,
  type PortableParsedAtlasSourceRecordArtifact,
} from './parsed-record-artifact';

export type AtlasParsedRecordMaterializerInput = {
  artifacts: readonly PortableParsedAtlasSourceRecordArtifact[];
  records: readonly NormalizedAtlasSourceRecord[];
};

export type AtlasParsedRecordMaterializerState = {
  artifactIds: string[];
};

export type AtlasParsedRecordArtifactChange =
  | {
      operation: 'delete';
      sourceRecordIdentity: string;
    }
  | {
      artifactId: string;
      operation: 'set';
      sourceRecordIdentity: string;
    };

type AtlasParsedRecordMaterializer = Materializer<
  AtlasParsedRecordMaterializerInput,
  AtlasSourceChangeSet,
  AtlasParsedRecordMaterializerState,
  PortableParsedAtlasSourceRecordArtifact,
  AtlasParsedRecordArtifactChange
>;

const operationInputPaths = (operation: AtlasSourceOperation) =>
  operation.kind === 'move' ? [operation.from, operation.to] : [operation.path];

const directOperationOutputs = (operation: AtlasSourceOperation) => {
  if (operation.kind === 'delete') return [];

  return [operation.record.canonicalPath];
};

const affectedOutputsFor = (
  changeSet: AtlasSourceChangeSet,
  dependencies: readonly MaterializerDependency[],
) => {
  const dependenciesByInput = new Map(
    dependencies.map(dependency => [dependency.input, dependency.outputs] as const),
  );
  const outputs = new Set<string>();

  for (const operation of changeSet.operations) {
    for (const inputPath of operationInputPaths(operation)) {
      for (const output of dependenciesByInput.get(inputPath) ?? []) {
        outputs.add(output);
      }
    }
    for (const output of directOperationOutputs(operation)) {
      outputs.add(output);
    }

    const removedPath = operation.kind === 'move' ? operation.from : operation.path;
    if (
      (operation.kind === 'delete' || operation.kind === 'move') &&
      !dependenciesByInput.has(removedPath)
    ) {
      return { status: 'unknown' as const, reason: `missing dependency for ${removedPath}` };
    }
  }

  return { status: 'known' as const, outputs: [...outputs].sort() };
};

const isCompatibleArtifact = (
  artifact: PortableParsedAtlasSourceRecordArtifact,
  record: NormalizedAtlasSourceRecord,
) =>
  artifact.sourceRecordIdentity === record.canonicalPath &&
  artifact.contentHash === atlasParsedRecordContentHash(record.content) &&
  artifact.materializerId === ATLAS_PARSED_RECORD_MATERIALIZER_ID &&
  artifact.materializerVersion === ATLAS_PARSED_RECORD_MATERIALIZER_VERSION;

const acceptedFrontierFor = (artifacts: readonly PortableParsedAtlasSourceRecordArtifact[]) =>
  `atlas-parsed-records:sha256:${createHash('sha256')
    .update(artifacts.map(artifact => artifact.artifactId).sort().join('\0'))
    .digest('hex')}`;

export const createAtlasParsedRecordMaterializer = (options: {
  parseRecord?: typeof parseAtlasSourceRecordArtifact;
} = {}): AtlasParsedRecordMaterializer => {
  const parseRecord = options.parseRecord ?? parseAtlasSourceRecordArtifact;

  return {
    id: ATLAS_PARSED_RECORD_MATERIALIZER_ID,
    version: ATLAS_PARSED_RECORD_MATERIALIZER_VERSION,
    affectedBy: affectedOutputsFor,
    derive: async (input, context) => {
      const previousArtifacts = new Map(
        input.artifacts.map(artifact => [artifact.sourceRecordIdentity, artifact]),
      );
      const affected = context.affectedOutputs ? new Set(context.affectedOutputs) : null;
      const artifacts = input.records
        .map(record => {
          const previous = previousArtifacts.get(record.canonicalPath);

          if (
            context.mode === 'incremental' &&
            previous &&
            !affected?.has(record.canonicalPath) &&
            isCompatibleArtifact(previous, record)
          ) {
            return previous;
          }

          return serializeParsedAtlasSourceRecordArtifact(parseRecord(record));
        })
        .sort((left, right) => left.sourceRecordIdentity.localeCompare(right.sourceRecordIdentity));
      const artifactsByIdentity = new Map(
        artifacts.map(artifact => [artifact.sourceRecordIdentity, artifact]),
      );
      const changes: AtlasParsedRecordArtifactChange[] = [];

      for (const [sourceRecordIdentity] of previousArtifacts) {
        if (!artifactsByIdentity.has(sourceRecordIdentity)) {
          changes.push({ operation: 'delete', sourceRecordIdentity });
        }
      }
      for (const artifact of artifacts) {
        if (
          previousArtifacts.get(artifact.sourceRecordIdentity)?.artifactId !== artifact.artifactId
        ) {
          changes.push({
            artifactId: artifact.artifactId,
            operation: 'set',
            sourceRecordIdentity: artifact.sourceRecordIdentity,
          });
        }
      }

      changes.sort((left, right) =>
        `${left.sourceRecordIdentity}:${left.operation}`.localeCompare(
          `${right.sourceRecordIdentity}:${right.operation}`,
        ),
      );

      return {
        acceptedFrontier: acceptedFrontierFor(artifacts),
        artifacts,
        changes,
        dependencies: input.records.map(record => ({
          input: record.sourcePath,
          outputs: [record.canonicalPath],
        })),
        diagnostics: [],
        state: { artifactIds: artifacts.map(artifact => artifact.artifactId) },
      };
    },
  };
};
