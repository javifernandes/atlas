import { headers } from 'next/headers';
import { getAtlasRequestAccess } from '@/auth/server';
import { AuthLanding } from '@/components/auth/auth-landing';
import { WorkspaceSettings } from '@/components/workspace/workspace-settings';

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

  return <WorkspaceSettings viewer={access.viewer} />;
};

export default WorkspaceSettingsPage;
