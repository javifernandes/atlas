import { loadAtlasPullRequestEvidenceObservation } from '../github/pull-request-evidence';
import {
  loadAtlasSourceObservation,
  loadAtlasSourceRegistrations,
  type AtlasLoadedSourceRevision,
} from '../sources/markdown-source';
import {
  normalizeAtlasSourceRecord,
  type NormalizedAtlasSourceRecord,
} from '../sources/normalized-source';

type LoadedAtlasProjectionInput = Awaited<ReturnType<typeof loadAtlasProjectionInput>>;
export type AtlasProjectionInput = Omit<
  LoadedAtlasProjectionInput,
  'incrementalBaselineProjectionRevisionId'
> & {
  incrementalBaselineProjectionRevisionId?: string | null;
};
export type AtlasProjectionSourceBaseline = {
  projectionRevisionId: string | null;
  records: NormalizedAtlasSourceRecord[];
  sourceRevisions: AtlasLoadedSourceRevision[];
};

const hasCompleteSourceBaseline = (
  baseline: AtlasProjectionSourceBaseline,
  expectedSourceIds: string[],
) => {
  const actualSourceIds = new Set(baseline.sourceRevisions.map(revision => revision.sourceId));
  return (
    actualSourceIds.size === expectedSourceIds.length &&
    expectedSourceIds.every(sourceId => actualSourceIds.has(sourceId))
  );
};

export const composeIncrementalSourceProjection = (input: {
  baseline: AtlasProjectionSourceBaseline;
  changedRecords: NormalizedAtlasSourceRecord[];
  changedSourceRevisions: AtlasLoadedSourceRevision[];
}) => {
  const changedSourceIds = new Set(
    input.changedSourceRevisions.map(revision => revision.sourceId),
  );

  if (changedSourceIds.size !== 1) {
    throw new Error('Incremental source observation must contain exactly one source revision.');
  }

  return {
    records: [
      ...input.baseline.records.filter(
        record => !changedSourceIds.has(record.sourceId ?? 'atlas'),
      ),
      ...input.changedRecords,
    ],
    sourceRevisions: [
      ...input.baseline.sourceRevisions.filter(
        revision => !changedSourceIds.has(revision.sourceId),
      ),
      ...input.changedSourceRevisions,
    ],
  };
};

export const loadAtlasProjectionInput = async (input: {
  baseline?: AtlasProjectionSourceBaseline;
  fetcher?: typeof fetch;
  preferRemoteAtlas?: boolean;
  repositoryFullName?: string;
  repoRoot: string;
}) => {
  const registrations = loadAtlasSourceRegistrations(input.repoRoot);
  const targetRegistration = input.repositoryFullName
    ? registrations.filter(
        registration =>
          registration.repository?.toLowerCase() === input.repositoryFullName?.toLowerCase(),
      )
    : [];
  const useIncrementalSourceObservation = Boolean(
    input.baseline &&
      targetRegistration.length === 1 &&
      hasCompleteSourceBaseline(
        input.baseline,
        registrations.map(registration => registration.sourceId),
      ),
  );
  const [sourceObservation, evidenceObservation] = await Promise.all([
    loadAtlasSourceObservation({
      fetcher: input.fetcher,
      preferRemoteAtlas: input.preferRemoteAtlas,
      repositoryFullName: useIncrementalSourceObservation
        ? input.repositoryFullName
        : undefined,
      repoRoot: input.repoRoot,
    }),
    loadAtlasPullRequestEvidenceObservation({
      fetcher: input.fetcher,
      repoRoot: input.repoRoot,
    }),
  ]);

  const observedRecords = sourceObservation.files.map(normalizeAtlasSourceRecord);
  const sourceProjection = useIncrementalSourceObservation
    ? composeIncrementalSourceProjection({
        baseline: input.baseline!,
        changedRecords: observedRecords,
        changedSourceRevisions: sourceObservation.sourceRevisions,
      })
    : {
        records: observedRecords,
        sourceRevisions: sourceObservation.sourceRevisions,
      };

  return {
    evidenceFailures: evidenceObservation.failures,
    evidenceSourceIds: evidenceObservation.successfulSources.map(source => source.sourceId),
    incrementalBaselineProjectionRevisionId: useIncrementalSourceObservation
      ? input.baseline!.projectionRevisionId
      : null,
    observedAt: sourceObservation.observedAt,
    observedPullRequests: evidenceObservation.pullRequests,
    records: sourceProjection.records,
    sourceRevisions: sourceProjection.sourceRevisions,
  };
};
