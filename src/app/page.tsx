import { headers } from 'next/headers';
import type { Metadata } from 'next';

import { readAtlasAuthConfiguration } from '@/auth/config';
import { getAtlasRequestAccess } from '@/auth/server';
import { getAtlasPageData } from '@/atlas/server/get-atlas-page-data';
import { listAtlasWorkspacesForUser } from '@/atlas/workspace/workspace-access';
import { AtlasExplorerClient } from '@/components/atlas-explorer-client';
import { AuthControl } from '@/components/auth/auth-control';
import { AuthLanding } from '@/components/auth/auth-landing';
import { WorkspaceOnboarding } from '@/components/workspace/workspace-onboarding';
import { WorkspaceHome } from '@/components/workspace/workspace-home';

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

  if (access.viewer) {
    const workspaces = await listAtlasWorkspacesForUser(access.viewer.id);
    if (workspaces.length === 0) return <WorkspaceOnboarding userName={access.viewer.name} />;
    return (
      <WorkspaceHome
        authAvailable={access.authAvailable}
        viewer={access.viewer}
        workspaces={workspaces}
      />
    );
  }

  const selectedStreamId = Array.isArray(searchParams?.session)
    ? searchParams.session[0]
    : searchParams?.session;
  const { executionStreams, snapshot } = await getAtlasPageData(
    undefined,
    selectedStreamId,
  );

  return (
    <>
      <AtlasExplorerClient
        executionStreams={executionStreams}
        isAuthenticated={false}
        snapshot={snapshot}
      />
      <AuthControl
        authAvailable={access.authAvailable}
        className='fixed right-4 top-4 z-50'
        viewer={access.viewer}
      />
    </>
  );
};

export default AtlasPage;
