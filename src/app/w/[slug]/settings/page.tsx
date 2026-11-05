import { headers } from 'next/headers';

import { getAtlasWorkspaceForUser } from '@/atlas/workspace/workspace-access';
import { getAtlasRequestAccess } from '@/auth/server';
import { AuthLanding } from '@/components/auth/auth-landing';
import { WorkspaceAccessDenied } from '@/components/workspace/workspace-access-denied';
import { WorkspaceSettings } from '@/components/workspace/workspace-settings';

export const dynamic = 'force-dynamic';

const WorkspaceSettingsPage = async ({ params }: { params: { slug: string } }) => {
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

  const workspace = await getAtlasWorkspaceForUser(access.viewer.id, params.slug);
  if (!workspace) return <WorkspaceAccessDenied viewer={access.viewer} />;
  return <WorkspaceSettings viewer={access.viewer} workspaceRole={workspace.role} />;
};

export default WorkspaceSettingsPage;
