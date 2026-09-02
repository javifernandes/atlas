import { loadAtlasPullRequestEvidenceObservation } from '../github/pull-request-evidence';
import {
  loadAtlasSourceObservation,
} from '../sources/markdown-source';
import { normalizeAtlasSourceRecord } from '../sources/normalized-source';

export type AtlasProjectionInput = Awaited<ReturnType<typeof loadAtlasProjectionInput>>;

export const loadAtlasProjectionInput = async (input: {
  fetcher?: typeof fetch;
  preferRemoteAtlas?: boolean;
  repoRoot: string;
}) => {
  const [sourceObservation, evidenceObservation] = await Promise.all([
    loadAtlasSourceObservation({
      fetcher: input.fetcher,
      preferRemoteAtlas: input.preferRemoteAtlas,
      repoRoot: input.repoRoot,
    }),
    loadAtlasPullRequestEvidenceObservation({
      fetcher: input.fetcher,
      repoRoot: input.repoRoot,
    }),
  ]);

  return {
    evidenceFailures: evidenceObservation.failures,
    evidenceSourceIds: evidenceObservation.successfulSources.map(source => source.sourceId),
    observedAt: sourceObservation.observedAt,
    observedPullRequests: evidenceObservation.pullRequests,
    records: sourceObservation.files.map(normalizeAtlasSourceRecord),
    sourceRevisions: sourceObservation.sourceRevisions,
  };
};
