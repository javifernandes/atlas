import { PlanWorkstreamExplorer } from '@/atlas/viewer/atlas-explorer';
import { getPlanWorkstreamSnapshot } from '@/atlas/markdown/build-snapshot';

export const revalidate = 300;

const AtlasPage = async () => (
  <PlanWorkstreamExplorer snapshot={await getPlanWorkstreamSnapshot()} />
);

export default AtlasPage;
