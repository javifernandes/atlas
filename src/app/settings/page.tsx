import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAtlasRequestAccess } from '@/auth/server';
import { listAtlasWorkspacesForUser } from '@/atlas/workspace/workspace-access';
import { AuthLanding } from '@/components/auth/auth-landing';
import { WorkspaceOnboarding } from '@/components/workspace/workspace-onboarding';

export const dynamic = 'force-dynamic';

const WorkspaceSettingsPage = async () => {
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

  const workspaces = await listAtlasWorkspacesForUser(access.viewer.id);
  if (workspaces.length === 0) return <WorkspaceOnboarding userName={access.viewer.name} />;
  redirect(`/w/${encodeURIComponent(workspaces[0]!.slug)}/settings`);
};

export default WorkspaceSettingsPage;
