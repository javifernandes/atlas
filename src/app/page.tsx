import { PlanWorkstreamExplorer } from '@/atlas/viewer/atlas-explorer';
import { getAtlasPageData } from '@/atlas/server/get-atlas-page-data';

export const dynamic = 'force-dynamic';

const AtlasPage = async () => {
  const { snapshot } = await getAtlasPageData();

  return <PlanWorkstreamExplorer snapshot={snapshot} />;
};

export default AtlasPage;
