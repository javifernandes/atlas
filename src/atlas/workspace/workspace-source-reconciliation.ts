import { createHash } from 'node:crypto';

import { buildPlanWorkstreamSnapshotFromFiles } from '../markdown/build-snapshot';
import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import {
  loadAtlasSourceSetObservation,
  type AtlasLoadedSourceRevision,
  type AtlasSource,
} from '../sources/markdown-source';

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
  fetcher?: typeof fetch;
  repoRoot: string;
  sources: AtlasWorkspaceSourceReconciliationInput['sources'];
}): Promise<AtlasWorkspaceSourceReconciliationResult> => {
  const observation = await loadAtlasSourceSetObservation({
    fetcher: input.fetcher,
    repoRoot: input.repoRoot,
    sources: input.sources,
  });
  const observedSourceIds = new Set(
    observation.sourceRevisions.map(revision => revision.sourceId),
  );
  const emptySources = input.sources.filter(source => !observedSourceIds.has(source.id));
  if (emptySources.length > 0) {
    throw new Error(
      `No Atlas plans or items were found in ${emptySources
        .map(source => source.repository)
        .join(', ')}. Expected Markdown under plans/ or atlas/items/.`,
    );
  }
  const snapshot = buildPlanWorkstreamSnapshotFromFiles(
    observation.files.filter(file => file.path.startsWith('plans/')),
    observation.files.filter(file => file.path.startsWith('atlas/items/')),
  );
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
