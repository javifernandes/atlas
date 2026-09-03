import { buildPlanWorkstreamSnapshotFromFiles } from '../markdown/build-snapshot';
import type { AtlasExecutionStreamProjection } from '../model/execution-stream';
import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import { getAtlasServerApplication } from './atlas-composition';

export type AtlasPageData = {
  executionStreams: AtlasExecutionStreamProjection[];
  snapshot: PlanWorkstreamSnapshot;
};

const emptyPageData = (): AtlasPageData => ({
  executionStreams: [],
  snapshot: { ...buildPlanWorkstreamSnapshotFromFiles([]), evidence: [] },
});

export const getAtlasPageData = async (
  userId?: string | null,
): Promise<AtlasPageData> => {
  const atlas = await getAtlasServerApplication();
  const [snapshot, executionStreams] = await Promise.all([
    atlas.getProjectionSnapshot(),
    userId ? atlas.getExecutionStreams(userId) : Promise.resolve([]),
  ]);

  return snapshot
    ? { executionStreams, snapshot }
    : { ...emptyPageData(), executionStreams };
};
