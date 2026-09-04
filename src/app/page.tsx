import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getAtlasRequestAccess } from '@/auth/server';
import { PlanWorkstreamExplorer } from '@/atlas/viewer/atlas-explorer';
import { getAtlasPageData } from '@/atlas/server/get-atlas-page-data';
import { AuthControl } from '@/components/auth/auth-control';

export const dynamic = 'force-dynamic';

type AtlasPageProps = {
  searchParams?: { session?: string | string[] };
};

const AtlasPage = async ({ searchParams }: AtlasPageProps) => {
  const access = await getAtlasRequestAccess(headers());

  if (!access.canRead) {
    redirect('/sign-in');
  }

  const selectedStreamId = Array.isArray(searchParams?.session)
    ? searchParams.session[0]
    : searchParams?.session;
  const { executionStreams, snapshot } = await getAtlasPageData(
    access.viewer?.id,
    selectedStreamId,
  );

  return (
    <>
      <PlanWorkstreamExplorer executionStreams={executionStreams} snapshot={snapshot} />
      <AuthControl
        authAvailable={access.authAvailable}
        className='fixed right-4 top-4 z-50'
        viewer={access.viewer}
      />
    </>
  );
};

export default AtlasPage;
