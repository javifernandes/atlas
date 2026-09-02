import { buildPlanWorkstreamSnapshotFromFiles } from '../markdown/build-snapshot';
import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import { getAtlasServerApplication } from './atlas-composition';

export type AtlasPageData = {
  snapshot: PlanWorkstreamSnapshot;
};

const emptyPageData = (): AtlasPageData => ({
  snapshot: { ...buildPlanWorkstreamSnapshotFromFiles([]), evidence: [] },
});

export const getAtlasPageData = async (): Promise<AtlasPageData> => {
  const atlas = await getAtlasServerApplication();
  const snapshot = await atlas.getProjectionSnapshot();

  return snapshot ? { snapshot } : emptyPageData();
};
