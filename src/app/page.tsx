import { PlanWorkstreamExplorer } from '@/atlas/viewer/atlas-explorer';
import { getAtlasPageData } from '@/atlas/server/get-atlas-page-data';

export const revalidate = 300;

const AtlasPage = async () => {
  const { itemContexts, snapshot } = await getAtlasPageData();

  return <PlanWorkstreamExplorer itemContexts={itemContexts} snapshot={snapshot} />;
};

export default AtlasPage;
