import { headers } from 'next/headers';
import type { Metadata } from 'next';

import { readAtlasAuthConfiguration } from '@/auth/config';
import { getAtlasRequestAccess } from '@/auth/server';
import { getAtlasPageData } from '@/atlas/server/get-atlas-page-data';
import { getAtlasWorkspaceForUser } from '@/atlas/workspace/workspace-access';
import { AtlasExplorerClient } from '@/components/atlas-explorer-client';
import { AuthControl } from '@/components/auth/auth-control';
import { AuthLanding } from '@/components/auth/auth-landing';
import { WorkspaceAccessDenied } from '@/components/workspace/workspace-access-denied';
import { WorkspaceControl } from '@/components/workspace/workspace-control';

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

  const workspace = access.viewer
    ? await getAtlasWorkspaceForUser(access.viewer.id)
    : null;

  if (access.visibility === 'private' && access.viewer && !workspace) {
    return <WorkspaceAccessDenied viewer={access.viewer} />;
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
      <AtlasExplorerClient
        executionStreams={executionStreams}
        isAuthenticated={access.viewer !== null}
        snapshot={snapshot}
      />
      <AuthControl
        authAvailable={access.authAvailable}
        className='fixed right-4 top-4 z-50'
        viewer={access.viewer}
      />
      {workspace ? <WorkspaceControl workspace={workspace} /> : null}
    </>
  );
};

export default AtlasPage;
