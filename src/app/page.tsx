import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getAtlasRequestAccess } from '@/auth/server';
import { PlanWorkstreamExplorer } from '@/atlas/viewer/atlas-explorer';
import { getAtlasPageData } from '@/atlas/server/get-atlas-page-data';
import { AuthControl } from '@/components/auth/auth-control';

export const dynamic = 'force-dynamic';

const AtlasPage = async () => {
  const access = await getAtlasRequestAccess(headers());

  if (!access.canRead) {
    redirect('/sign-in');
  }

  const { snapshot } = await getAtlasPageData();

  return (
    <>
      <PlanWorkstreamExplorer snapshot={snapshot} />
      <AuthControl
        authAvailable={access.authAvailable}
        className='fixed right-4 top-4 z-50'
        viewer={access.viewer}
      />
    </>
  );
};

export default AtlasPage;
