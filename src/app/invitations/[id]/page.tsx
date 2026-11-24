import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { getAtlasRequestAccess } from '@/auth/server';
import { AuthLanding } from '@/components/auth/auth-landing';
import { WorkspaceInvitationResponse } from '@/components/workspace/workspace-invitation-response';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { follow: false, index: false } };

const WorkspaceInvitationPage = async ({ params }: { params: { id: string } }) => {
  const access = await getAtlasRequestAccess(headers());
  const invitationPath = `/invitations/${encodeURIComponent(params.id)}`;
  if (!access.viewer) {
    return (
      <AuthLanding
        authAvailable={access.authAvailable}
        callbackURL={invitationPath}
        configurationError={access.configurationError}
        errorCallbackURL={invitationPath}
        viewer={access.viewer}
      />
    );
  }
  return <WorkspaceInvitationResponse invitationId={params.id} viewer={access.viewer} />;
};

export default WorkspaceInvitationPage;
