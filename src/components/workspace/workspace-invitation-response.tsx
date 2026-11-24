'use client';

import { useOperation } from '@ontahi/react/graph';
import { useEffect, useState } from 'react';

import { AtlasWorkspaceInvitationClient } from '@/atlas/client/workspace-administration';
import { atlasWorkspaceInvitationRef } from '@/atlas/model/workspace-administration';
import type { AtlasViewer } from '@/auth/access';
import { atlasAuthClient } from '@/auth/client';
import {
  WorkspaceInvitationResponseView,
  type WorkspaceInvitation,
} from './workspace-invitation-response-view';

export const WorkspaceInvitationResponse = ({
  invitationId,
  viewer,
}: {
  invitationId: string;
  viewer: AtlasViewer;
}) => {
  const inspect = useOperation(AtlasWorkspaceInvitationClient.domain.inspect);
  const claim = useOperation(AtlasWorkspaceInvitationClient.domain.claim);
  const accept = useOperation(AtlasWorkspaceInvitationClient.domain.accept);
  const decline = useOperation(AtlasWorkspaceInvitationClient.domain.decline);
  const [invitation, setInvitation] = useState<WorkspaceInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identityMismatch, setIdentityMismatch] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const receiver = atlasWorkspaceInvitationRef(invitationId);
  const load = async () => {
    setError(null);
    setIdentityMismatch(false);
    const result = await inspect.executeAsync({ invitation: receiver });
    if (!result.ok) {
      const failureReason =
        result.kind === 'failed'
        && result.failure
        && typeof result.failure === 'object'
        && 'reason' in result.failure
        && typeof result.failure.reason === 'string'
          ? result.failure.reason
          : null;
      if (
        failureReason === 'workspace_invitation_recipient_mismatch'
      ) {
        setIdentityMismatch(true);
      }
      setError(result.message);
      return;
    }
    setInvitation(result.value);
  };

  useEffect(() => {
    void load();
  }, [invitationId]);

  const claimInvitation = async () => {
    setError(null);
    const result = await claim.executeAsync({ invitation: receiver });
    if (!result.ok) return setError(result.message);
    await load();
  };

  const acceptInvitation = async () => {
    setError(null);
    const result = await accept.executeAsync({ invitation: receiver });
    if (!result.ok) return setError(result.message);
    window.location.assign(`/w/${result.value.workspaceSlug}`);
  };

  const declineInvitation = async () => {
    setError(null);
    const result = await decline.executeAsync({ invitation: receiver });
    if (!result.ok) return setError(result.message);
    await load();
  };

  const useAnotherAccount = async () => {
    setError(null);
    setSwitchingAccount(true);
    const result = await atlasAuthClient.signOut();
    if (result.error) {
      setError(result.error.message ?? 'Atlas could not sign out this account.');
      setSwitchingAccount(false);
      return;
    }
    window.location.assign(`/invitations/${encodeURIComponent(invitationId)}`);
  };

  const busy = inspect.isExecuting || claim.isExecuting || accept.isExecuting || decline.isExecuting;
  return (
    <WorkspaceInvitationResponseView
      busy={busy}
      claiming={claim.isExecuting}
      error={error}
      identityMismatch={identityMismatch}
      invitation={invitation}
      loading={inspect.isExecuting}
      onAccept={acceptInvitation}
      onClaim={claimInvitation}
      onDecline={declineInvitation}
      onUseAnotherAccount={useAnotherAccount}
      switchingAccount={switchingAccount}
      viewer={viewer}
    />
  );
};
