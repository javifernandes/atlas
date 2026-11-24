import {
  loadAtlasPullRequestEvidenceObservation,
  type AtlasPullRequestEvidenceReplicaStore,
} from '../github/pull-request-evidence';
import { loadAtlasReleaseEvidenceObservation } from '../github/release-evidence';
import {
  loadAtlasSourceObservation,
  loadAtlasSourceRegistrations,
  type AtlasLoadedSourceRevision,
} from '../sources/markdown-source';
import {
  normalizeAtlasSourceRecord,
  type NormalizedAtlasSourceRecord,
} from '../sources/normalized-source';
import {
  applyAtlasSourceChangeSet,
  atlasSourceRef,
  deriveAtlasSourceChangeSet,
  type AtlasSourceChangeSet,
} from '../sources/source-changeset';
import type { AtlasReconciliationStageObserver } from '../persistence/reconciliation-observability';

type LoadedAtlasProjectionInput = Awaited<ReturnType<typeof loadAtlasProjectionInput>>;
export type AtlasProjectionInput = Omit<
  LoadedAtlasProjectionInput,
  | 'incrementalBaselineProjectionRevisionId'
  | 'observedReleases'
  | 'releaseFailures'
  | 'sourceChangeSet'
> & {
  incrementalBaselineProjectionRevisionId?: string | null;
  observedReleases?: LoadedAtlasProjectionInput['observedReleases'];
  releaseFailures?: LoadedAtlasProjectionInput['releaseFailures'];
  sourceChangeSet?: AtlasSourceChangeSet | null;
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

export const hasExpectedSourceBaseRevision = (
  baseline: AtlasProjectionSourceBaseline,
  sourceId: string,
  expectedRevision?: string,
) =>
  !expectedRevision ||
  baseline.sourceRevisions.some(
    revision => revision.sourceId === sourceId && revision.revision === expectedRevision,
  );

export const composeIncrementalSourceProjection = (input: {
  baseline: AtlasProjectionSourceBaseline;
  changedRecords: NormalizedAtlasSourceRecord[];
  changedSourceRevisions: AtlasLoadedSourceRevision[];
  observedAt: string;
  providerDeliveryId?: string | null;
}) => {
  const changedSourceIds = new Set(
    input.changedSourceRevisions.map(revision => revision.sourceId),
  );

  if (changedSourceIds.size !== 1) {
    throw new Error('Incremental source observation must contain exactly one source revision.');
  }

  const sourceId = [...changedSourceIds][0]!;
  const baseRevision = input.baseline.sourceRevisions.find(
    revision => revision.sourceId === sourceId,
  );
  const targetRevision = input.changedSourceRevisions[0]!;
  if (!baseRevision) {
    throw new Error(`Incremental Source ${sourceId} has no baseline revision.`);
  }
  const source = atlasSourceRef(sourceId);
  const sourceChangeSet = deriveAtlasSourceChangeSet({
    baseRecords: input.baseline.records.filter(
      record => (record.sourceId ?? 'atlas') === sourceId,
    ),
    baseRevision: {
      revisionKey: baseRevision.revision,
      revisionScheme: baseRevision.revisionKind,
      source,
    },
    observedAt: input.observedAt,
    providerDeliveryId: input.providerDeliveryId,
    targetRecords: input.changedRecords,
    targetRevision: {
      revisionKey: targetRevision.revision,
      revisionScheme: targetRevision.revisionKind,
      source,
    },
  });
  const application = applyAtlasSourceChangeSet({
    changeSet: sourceChangeSet,
    currentRevision: sourceChangeSet.baseRevision,
    records: input.baseline.records.filter(
      record => (record.sourceId ?? 'atlas') === sourceId,
    ),
  });
  if (application.status !== 'applied') {
    throw new Error(`Incremental Source ChangeSet was not applied: ${application.status}.`);
  }

  return {
    records: [
      ...input.baseline.records.filter(
        record => !changedSourceIds.has(record.sourceId ?? 'atlas'),
      ),
      ...application.records,
    ],
    sourceRevisions: [
      ...input.baseline.sourceRevisions.filter(
        revision => !changedSourceIds.has(revision.sourceId),
      ),
      ...input.changedSourceRevisions,
    ],
    sourceChangeSet,
  };
};

export const loadAtlasProjectionInput = async (input: {
  baseline?: AtlasProjectionSourceBaseline;
  expectedBaseRevision?: string;
  fetcher?: typeof fetch;
  preferRemoteAtlas?: boolean;
  providerDeliveryId?: string | null;
  pullRequestEvidenceReplicaStore?: AtlasPullRequestEvidenceReplicaStore;
  reconciliationObserver?: AtlasReconciliationStageObserver;
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
      hasExpectedSourceBaseRevision(
        input.baseline,
        targetRegistration[0]!.sourceId,
        input.expectedBaseRevision,
      ) &&
      hasCompleteSourceBaseline(
        input.baseline,
        registrations.map(registration => registration.sourceId),
      ),
  );
  const measure = <TValue>(
    stage: string,
    run: () => Promise<TValue>,
    metrics: (value: TValue) => Record<string, boolean | number | string | null>,
  ) => input.reconciliationObserver?.measure(stage, run, metrics) ?? run();
  const [sourceObservation, evidenceObservation, releaseObservation] = await Promise.all([
    measure(
      'load-markdown-sources',
      () =>
        loadAtlasSourceObservation({
          fetcher: input.fetcher,
          preferRemoteAtlas: input.preferRemoteAtlas,
          repositoryFullName: useIncrementalSourceObservation
            ? input.repositoryFullName
            : undefined,
          repoRoot: input.repoRoot,
        }),
      value => ({
        fileCount: value.files.length,
        sourceCount: value.sourceRevisions.length,
        targeted: useIncrementalSourceObservation,
      }),
    ),
    measure(
      'load-pull-request-evidence',
      () =>
        loadAtlasPullRequestEvidenceObservation({
          fetcher: input.fetcher,
          replicaStore: input.pullRequestEvidenceReplicaStore,
          repoRoot: input.repoRoot,
        }),
      value => ({
        changedPullRequestCount: value.changedPullRequestCount,
        failureCount: value.failures.length,
        fetchedPullRequestCount: value.fetchedPullRequestCount,
        pullRequestCount: value.pullRequests.length,
        reusedPullRequestCount: value.reusedPullRequestCount,
        sourceCount: value.successfulSources.length,
      }),
    ),
    measure(
      'load-release-evidence',
      () =>
        loadAtlasReleaseEvidenceObservation({
          fetcher: input.fetcher,
          repoRoot: input.repoRoot,
        }),
      value => ({
        failureCount: value.failures.length,
        releaseCount: value.releases.length,
      }),
    ),
  ]);

  const observedRecords = sourceObservation.files.map(normalizeAtlasSourceRecord);
  const sourceProjection = useIncrementalSourceObservation
    ? composeIncrementalSourceProjection({
        baseline: input.baseline!,
        changedRecords: observedRecords,
        changedSourceRevisions: sourceObservation.sourceRevisions,
        observedAt: sourceObservation.observedAt,
        providerDeliveryId: input.providerDeliveryId,
      })
    : {
        records: observedRecords,
        sourceChangeSet: null,
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
    observedReleases: releaseObservation.releases,
    releaseFailures: releaseObservation.failures,
    records: sourceProjection.records,
    sourceChangeSet: sourceProjection.sourceChangeSet,
    sourceRevisions: sourceProjection.sourceRevisions,
  };
};
