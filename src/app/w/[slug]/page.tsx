import { headers } from 'next/headers';

import { getAtlasPageData } from '@/atlas/server/get-atlas-page-data';
import { readAtlasModelConfiguration } from '@/atlas/server/model-provider';
import {
  DEFAULT_ATLAS_WORKSPACE_ID,
  getAtlasWorkspaceForUser,
  listAtlasWorkspacesForUser,
} from '@/atlas/workspace/workspace-access';
import { getAtlasRequestAccess } from '@/auth/server';
import { AtlasExplorerClient } from '@/components/atlas-explorer-client';
import { AuthControl } from '@/components/auth/auth-control';
import { AuthLanding } from '@/components/auth/auth-landing';
import { PlanAssistant } from '@/components/plan-assistant';
import { WorkspaceAccessDenied } from '@/components/workspace/workspace-access-denied';
import { WorkspaceControl } from '@/components/workspace/workspace-control';
import { WorkspaceEmptyState } from '@/components/workspace/workspace-empty-state';

export const dynamic = 'force-dynamic';

type WorkspacePageProps = {
  params: { slug: string };
  searchParams?: { session?: string | string[] };
};

const WorkspacePage = async ({ params, searchParams }: WorkspacePageProps) => {
  const access = await getAtlasRequestAccess(headers());
  if (!access.canRead || !access.viewer) {
    return (
      <AuthLanding
        authAvailable={access.authAvailable}
        configurationError={access.configurationError}
        viewer={access.viewer}
      />
    );
  }

  const [workspace, workspaces] = await Promise.all([
    getAtlasWorkspaceForUser(access.viewer.id, params.slug),
    listAtlasWorkspacesForUser(access.viewer.id),
  ]);
  if (!workspace) return <WorkspaceAccessDenied viewer={access.viewer} />;

  if (workspace.id !== DEFAULT_ATLAS_WORKSPACE_ID) {
    return <WorkspaceEmptyState workspace={workspace} workspaces={workspaces} />;
  }

  const selectedStreamId = Array.isArray(searchParams?.session)
    ? searchParams.session[0]
    : searchParams?.session;
  const { executionStreams, snapshot } = await getAtlasPageData(
    access.viewer.id,
    selectedStreamId,
  );

  return (
    <>
      <AtlasExplorerClient
        executionStreams={executionStreams}
        isAuthenticated
        snapshot={snapshot}
      />
      <AuthControl
        authAvailable={access.authAvailable}
        className='fixed right-4 top-4 z-50'
        viewer={access.viewer}
      />
      <WorkspaceControl workspace={workspace} workspaces={workspaces} />
      {readAtlasModelConfiguration().enabled ? (
        <PlanAssistant workspaceId={workspace.id} />
      ) : null}
    </>
  );
};

export default WorkspacePage;
