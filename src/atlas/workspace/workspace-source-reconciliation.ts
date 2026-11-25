import { createHash } from 'node:crypto';

import { buildAtlasOntahiDataset, buildAtlasOntahiDatasetFromSource } from '../domain/atlas-application';
import type { materializeAtlasParsedRecords } from '../markdown/parsed-record-materialization';
import {
  loadAtlasPullRequestEvidenceObservation,
  type AtlasGitHubEvidenceSource,
  type AtlasObservedPullRequest,
  type AtlasPullRequestEvidenceReplicaStore,
} from '../github/pull-request-evidence';
import { parseGitHubRepositoryName } from '../github/repository';
import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import {
  loadAtlasSourceDefinitions,
  loadAtlasSourceSetObservation,
  type AtlasLoadedSourceRevision,
  type AtlasMarkdownFile,
  type AtlasSource,
} from '../sources/markdown-source';
import { normalizeAtlasSourceRecord } from '../sources/normalized-source';

export const ATLAS_WORKSPACE_SOURCE_RECONCILIATION_RESOURCE =
  'atlas.workspace.source-reconciliation';

export type AtlasWorkspaceSourceReconciliationInput = {
  sources: Array<Pick<AtlasSource, 'id' | 'ref' | 'repository'>>;
  workspaceId: string;
};

export type AtlasWorkspaceSourceReconciliationResult = {
  observedAt: string;
  snapshot: PlanWorkstreamSnapshot;
  sourceRevisionSetHash: string;
  sourceRevisions: AtlasLoadedSourceRevision[];
};

export type AtlasWorkspaceSourceReconciler = {
  reconcile(
    input: AtlasWorkspaceSourceReconciliationInput,
  ): Promise<AtlasWorkspaceSourceReconciliationResult>;
};

export const reconcileAtlasWorkspaceSources = async (input: {
  localSourceFiles?: readonly AtlasMarkdownFile[];
  parseSource?: (input: Parameters<typeof materializeAtlasParsedRecords>[0]) =>
    Promise<Awaited<ReturnType<typeof materializeAtlasParsedRecords>>['source']>;
  fetcher?: typeof fetch;
  observePullRequestEvidence?: (input: {
    sources: AtlasGitHubEvidenceSource[];
  }) => Promise<{
    failures: Array<{ repositoryFullName: string; message: string }>;
    pullRequests: AtlasObservedPullRequest[];
  }>;
  pullRequestEvidenceReplicaStore?: AtlasPullRequestEvidenceReplicaStore;
  repoRoot: string;
  sources: AtlasWorkspaceSourceReconciliationInput['sources'];
}): Promise<AtlasWorkspaceSourceReconciliationResult> => {
  const configuredSources =
    process.env.NODE_ENV === 'production' ? [] : loadAtlasSourceDefinitions(input.repoRoot);
  const sources = input.sources.map(source => {
    const configuredSource = configuredSources.find(candidate => candidate.id === source.id);

    if (configuredSource?.localRoot) {
      return { ...source, localRoot: configuredSource.localRoot };
    }

    return source.id === 'atlas' && process.env.NODE_ENV !== 'production'
      ? { ...source, localRoot: '.' }
      : source;
  });
  const evidenceSources = sources.flatMap(source => {
    const repositoryFullName = parseGitHubRepositoryName(source.repository);

    return repositoryFullName ? [{ repositoryFullName, sourceId: source.id }] : [];
  });
  const observePullRequestEvidence = input.observePullRequestEvidence ??
    (input.pullRequestEvidenceReplicaStore
      ? ({ sources: selectedSources }: { sources: AtlasGitHubEvidenceSource[] }) =>
          loadAtlasPullRequestEvidenceObservation({
            fetcher: input.fetcher,
            replicaStore: input.pullRequestEvidenceReplicaStore,
            repoRoot: input.repoRoot,
            sources: selectedSources,
          })
      : async () => ({ failures: [], pullRequests: [] }));
  const [observation, evidenceObservation] = await Promise.all([
    loadAtlasSourceSetObservation({
      fetcher: input.fetcher, repoRoot: input.repoRoot, sources, localSourceFiles: input.localSourceFiles,
    }),
    observePullRequestEvidence({ sources: evidenceSources }),
  ]);
  const observedSourceIds = new Set(
    observation.sourceRevisions.map(revision => revision.sourceId),
  );
  const emptySources = sources.filter(source => !observedSourceIds.has(source.id));
  if (emptySources.length > 0) {
    throw new Error(
      `No Atlas plans or items were found in ${emptySources
        .map(source => source.repository)
        .join(', ')}. Expected plans, Atlas Items, or an atlas.package.md manifest.`,
    );
  }
  if (evidenceObservation.failures.length > 0) {
    throw new Error(
      `Could not observe Workspace implementation evidence from ${evidenceObservation.failures
        .map(failure => `${failure.repositoryFullName}: ${failure.message}`)
        .join('; ')}`,
    );
  }
  const records = observation.files.map(normalizeAtlasSourceRecord);
  const sourceRevisions = observation.sourceRevisions;
  const dataset = input.parseSource
    ? buildAtlasOntahiDatasetFromSource(
        await input.parseSource({ records, sourceRevisions }),
        records,
        evidenceObservation.pullRequests,
        sourceRevisions,
      )
    : buildAtlasOntahiDataset(records, evidenceObservation.pullRequests, sourceRevisions);
  const snapshot = JSON.parse(
    dataset.ProjectionRevision[0]?.snapshotJson ?? '{}',
  ) as PlanWorkstreamSnapshot;
  const sourceRevisionSetHash = createHash('sha256')
    .update(
      observation.sourceRevisions
        .map(revision => revision.id)
        .sort((left, right) => left.localeCompare(right))
        .join('\0'),
    )
    .digest('hex');

  return {
    observedAt: observation.observedAt,
    snapshot,
    sourceRevisionSetHash,
    sourceRevisions: observation.sourceRevisions,
  };
};
