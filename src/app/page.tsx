import { headers } from 'next/headers';
import type { Metadata } from 'next';

import { readAtlasAuthConfiguration } from '@/auth/config';
import { getAtlasRequestAccess } from '@/auth/server';
import { PlanWorkstreamExplorer } from '@/atlas/viewer/atlas-explorer';
import { getAtlasPageData } from '@/atlas/server/get-atlas-page-data';
import { AuthControl } from '@/components/auth/auth-control';
import { AuthLanding } from '@/components/auth/auth-landing';

export const dynamic = 'force-dynamic';

export const generateMetadata = (): Metadata => {
  const configuration = readAtlasAuthConfiguration();

  return configuration.visibility === 'public' && !configuration.configurationError
    ? {}
    : {
        robots: {
          follow: false,
          googleBot: { follow: false, index: false },
          index: false,
        },
      };
};

type AtlasPageProps = {
  searchParams?: { session?: string | string[] };
};

const AtlasPage = async ({ searchParams }: AtlasPageProps) => {
  const access = await getAtlasRequestAccess(headers());

  if (!access.canRead) {
    return (
      <AuthLanding
        authAvailable={access.authAvailable}
        configurationError={access.configurationError}
        viewer={access.viewer}
      />
    );
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
