import { headers } from 'next/headers';

import { getAtlasRequestAccess } from '@/auth/server';
import { AuthLanding } from '@/components/auth/auth-landing';
import { WorkspaceOnboarding } from '@/components/workspace/workspace-onboarding';

export const dynamic = 'force-dynamic';

const NewWorkspacePage = async () => {
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
  return <WorkspaceOnboarding userName={access.viewer.name} />;
};

export default NewWorkspacePage;
