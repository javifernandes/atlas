import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  getAtlasStoryParameters,
  getStorybookEvidenceById,
} from '@/atlas/evidence/storybook-evidence';
import type { AtlasViewer } from '@/auth/access';
import {
  WorkspaceInvitationResponseView,
  type WorkspaceInvitation,
} from './workspace-invitation-response-view';

const viewer: AtlasViewer = {
  email: 'recipient@example.com',
  id: 'user-recipient',
  image: null,
  name: 'Ada Recipient',
};

const invitation: WorkspaceInvitation = {
  claimedByCurrentUser: false,
  expiresAt: '2027-01-15T15:00:00.000Z',
  id: 'invitation-demo',
  invitedByName: 'Grace Owner',
  proposedRole: 'collaborator',
  status: 'pending',
  workspaceId: 'workspace-atlas',
  workspaceName: 'Atlas',
  workspaceSlug: 'atlas',
};

const evidenceParameters = (id: string) =>
  getAtlasStoryParameters(getStorybookEvidenceById(id));

const meta = {
  title: 'Interactions/Respond to Workspace Invitation',
  component: WorkspaceInvitationResponseView,
  args: {
    invitation,
    onAccept: () => undefined,
    onClaim: () => undefined,
    onDecline: () => undefined,
    onUseAnotherAccount: () => undefined,
    viewer,
  },
  parameters: evidenceParameters('pending-invitation'),
} satisfies Meta<typeof WorkspaceInvitationResponseView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CheckingInvitation: Story = {
  args: {
    invitation: null,
    loading: true,
  },
  parameters: evidenceParameters('checking-invitation'),
};

export const PendingInvitation: Story = {
  parameters: evidenceParameters('pending-invitation'),
};

export const ClaimingInvitation: Story = {
  args: {
    busy: true,
    claiming: true,
  },
  parameters: evidenceParameters('claiming-invitation'),
};

export const ChooseResponse: Story = {
  args: {
    invitation: {
      ...invitation,
      claimedByCurrentUser: true,
      status: 'claimed',
    },
  },
  parameters: evidenceParameters('choose-response'),
};

export const IdentityMismatch: Story = {
  args: {
    identityMismatch: true,
    invitation: null,
  },
  parameters: evidenceParameters('identity-mismatch'),
};

export const SwitchingAccount: Story = {
  args: {
    identityMismatch: true,
    invitation: null,
    switchingAccount: true,
  },
  parameters: evidenceParameters('switching-account'),
};

const terminalStory = (
  status: Extract<WorkspaceInvitation['status'], 'accepted' | 'declined' | 'revoked' | 'expired'>,
  evidenceId: string,
): Story => ({
  args: {
    invitation: {
      ...invitation,
      claimedByCurrentUser: true,
      status,
    },
  },
  parameters: evidenceParameters(evidenceId),
});

export const Accepted = terminalStory('accepted', 'accepted');
export const Declined = terminalStory('declined', 'declined');
export const Revoked = terminalStory('revoked', 'revoked');
export const Expired = terminalStory('expired', 'expired');

export const RuntimeFailure: Story = {
  args: {
    error: 'Atlas could not inspect this invitation. Try again in a moment.',
    invitation: null,
  },
  parameters: evidenceParameters('runtime-failure'),
};
