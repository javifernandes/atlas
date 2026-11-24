import { createHash } from 'node:crypto';

import {
  createReplicatedVersionedMaterializerRunner,
  type MaterializerDependency,
  type ReplicatedVersionedModelRebuildRequired,
  type ReplicatedVersionedModelSnapshot,
} from '@ontahi/core';

import type { AtlasLoadedSourceRevision } from '../sources/markdown-source';
import type { NormalizedAtlasSourceRecord } from '../sources/normalized-source';
import type { AtlasSourceChangeSet } from '../sources/source-changeset';
import {
  assembleParsedAtlasSourceRecordArtifacts,
  deserializeParsedAtlasSourceRecordArtifact,
  parseAtlasSourceRecordArtifact,
  type PortableParsedAtlasSourceRecordArtifact,
} from './parsed-record-artifact';
import {
  createAtlasParsedRecordMaterializer,
  type AtlasParsedRecordMaterializerState,
} from './parsed-record-materializer';

export const ATLAS_PARSED_RECORD_MATERIALIZATION_SCOPE = 'atlas:canonical-projection';

export type AtlasParsedRecordMaterializationSeed = {
  artifacts: readonly PortableParsedAtlasSourceRecordArtifact[];
  dependencies: readonly MaterializerDependency[];
  snapshot: ReplicatedVersionedModelSnapshot<AtlasParsedRecordMaterializerState>;
};

type AtlasParsedRecordMaterializationResult = AtlasParsedRecordMaterializationSeed & {
  fallbackReason: ReplicatedVersionedModelRebuildRequired['reason'] | null;
  mode: 'incremental' | 'rebuild';
  parsedRecordCount: number;
  reusedRecordCount: number;
  source: ReturnType<typeof assembleParsedAtlasSourceRecordArtifacts>;
};

const sourceFrontierFor = (
  revisions: readonly AtlasLoadedSourceRevision[],
  override?: { revision: string; revisionKind: 'git' | 'content-sha256'; sourceId: string },
) => {
  const identities = revisions
    .map(revision =>
      revision.sourceId === override?.sourceId
        ? `${revision.sourceId}\0${override.revisionKind}\0${override.revision}`
        : `${revision.sourceId}\0${revision.revisionKind}\0${revision.revision}`,
    )
    .sort();

  return `atlas-sources:sha256:${createHash('sha256').update(identities.join('\0')).digest('hex')}`;
};

export const materializeAtlasParsedRecords = async (input: {
  changeSet?: AtlasSourceChangeSet | null;
  initial?: AtlasParsedRecordMaterializationSeed | null;
  parseRecord?: typeof parseAtlasSourceRecordArtifact;
  records: readonly NormalizedAtlasSourceRecord[];
  sourceRevisions: readonly AtlasLoadedSourceRevision[];
}): Promise<AtlasParsedRecordMaterializationResult> => {
  let parsedRecordCount = 0;
  const parseRecord = (...args: Parameters<typeof parseAtlasSourceRecordArtifact>) => {
    parsedRecordCount += 1;
    return (input.parseRecord ?? parseAtlasSourceRecordArtifact)(...args);
  };
  const runner = createReplicatedVersionedMaterializerRunner(
    createAtlasParsedRecordMaterializer({ parseRecord }),
    input.initial
      ? {
          initial: {
            dependencies: input.initial.dependencies,
            snapshot: input.initial.snapshot,
          },
        }
      : {},
  );
  const sourceFrontier = sourceFrontierFor(input.sourceRevisions);
  const incrementalRequest = input.changeSet
    ? {
        baseSourceFrontier: sourceFrontierFor(input.sourceRevisions, {
          revision: input.changeSet.baseRevision.revisionKey,
          revisionKind: input.changeSet.baseRevision.revisionScheme,
          sourceId: String(input.changeSet.source.locator.id),
        }),
        delta: input.changeSet,
        input: {
          artifacts: input.initial?.artifacts ?? [],
          records: input.records,
        },
        mode: 'incremental' as const,
        sourceFrontier,
      }
    : null;
  let execution = incrementalRequest
    ? await runner.run(incrementalRequest)
    : await runner.run({
        input: { artifacts: [], records: input.records },
        mode: 'rebuild',
        sourceFrontier,
      });
  const fallbackReason =
    execution.result.status === 'rebuild-required' ? execution.result.reason : null;
  let mode: AtlasParsedRecordMaterializationResult['mode'] = incrementalRequest
    ? 'incremental'
    : 'rebuild';

  if (execution.result.status === 'rebuild-required') {
    mode = 'rebuild';
    parsedRecordCount = 0;
    execution = await runner.run({
      input: { artifacts: [], records: input.records },
      mode: 'rebuild',
      sourceFrontier,
    });
  }

  if (execution.result.status !== 'accepted' || !execution.output) {
    const reason =
      execution.result.status === 'accepted'
        ? 'accepted-without-output'
        : execution.result.reason;
    throw new Error(`Atlas parsed-record materialization failed: ${reason}.`);
  }

  const artifacts = execution.output.artifacts;

  return {
    artifacts,
    dependencies: runner.dependencies(),
    fallbackReason,
    mode,
    parsedRecordCount,
    reusedRecordCount: mode === 'incremental' ? artifacts.length - parsedRecordCount : 0,
    snapshot: execution.result.snapshot,
    source: assembleParsedAtlasSourceRecordArtifacts({
      artifacts: artifacts.map(deserializeParsedAtlasSourceRecordArtifact),
      records: input.records,
    }),
  };
};
