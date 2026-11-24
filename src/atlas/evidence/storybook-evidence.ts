export type AtlasStorybookEvidence = {
  activity: string;
  description: string;
  id: string;
  interaction: string;
  itemId: string;
  storyId: string;
  title: string;
};

const RESPOND_TO_INVITATION_ITEM =
  'spec-workstream-atlas.access-identity.workspace.respond-to-invitation';
const RESPOND_TO_INVITATION = 'respond-to-workspace-invitation';

const evidence = (
  id: string,
  title: string,
  activity: string,
  description: string,
  group = 'interactions-respond-to-workspace-invitation',
): AtlasStorybookEvidence => ({
  activity,
  description,
  id,
  interaction: RESPOND_TO_INVITATION,
  itemId: RESPOND_TO_INVITATION_ITEM,
  storyId: `${group}--${id}`,
  title,
});

export const atlasStorybookEvidence = [
  evidence(
    'checking-invitation',
    'Checking invitation',
    'resolve-context',
    'Invitation context is being resolved.',
  ),
  evidence(
    'pending-invitation',
    'Pending invitation',
    'claim-invitation',
    'A valid invitation is ready to be claimed.',
  ),
  evidence(
    'claiming-invitation',
    'Claiming invitation',
    'claim-invitation',
    'The current user is claiming the invitation.',
  ),
  evidence(
    'choose-response',
    'Choose response',
    'choose-response',
    'The recipient may accept or decline.',
  ),
  evidence(
    'identity-mismatch',
    'Identity mismatch',
    'identity-proof-refused',
    'The authenticated identity cannot claim this invitation.',
  ),
  evidence(
    'switching-account',
    'Switching account',
    'authenticate',
    'The recipient is changing authentication identity.',
  ),
  evidence(
    'accepted',
    'Accepted',
    'invitation-accepted',
    'The invitation produced active Workspace access.',
  ),
  evidence(
    'declined',
    'Declined',
    'invitation-declined',
    'The recipient declined Workspace access.',
  ),
  evidence(
    'revoked',
    'Revoked',
    'invitation-unavailable',
    'The invitation was revoked before response.',
  ),
  evidence(
    'expired',
    'Expired',
    'invitation-unavailable',
    'The invitation expired before response.',
  ),
  evidence(
    'runtime-failure',
    'Runtime failure',
    'resolve-context',
    'Invitation inspection could not complete.',
  ),
  evidence(
    'sign-in-to-respond',
    'Sign in to respond',
    'authenticate',
    'Authentication is required before continuing.',
    'interactions-respond-to-workspace-invitation-authentication',
  ),
  evidence(
    'authentication-rejected',
    'Authentication rejected',
    'authenticate',
    'The authentication provider rejected the request.',
    'interactions-respond-to-workspace-invitation-authentication',
  ),
  evidence(
    'authentication-unavailable',
    'Authentication unavailable',
    'authenticate',
    'Authentication is not configured for this deployment.',
    'interactions-respond-to-workspace-invitation-authentication',
  ),
] satisfies AtlasStorybookEvidence[];

export const getStorybookEvidenceForItem = (itemId: string) =>
  atlasStorybookEvidence.filter(item => item.itemId === itemId);

export const getStorybookBaseUrl = () => {
  const configuredUrl = process.env.NEXT_PUBLIC_ATLAS_STORYBOOK_URL?.trim().replace(/\/$/, '');

  if (configuredUrl) return configuredUrl;
  return process.env.NODE_ENV === 'development' ? 'http://localhost:6006' : null;
};

export const getStorybookPreviewUrl = (item: AtlasStorybookEvidence) => {
  const baseUrl = getStorybookBaseUrl();
  return baseUrl ? `${baseUrl}/iframe.html?id=${item.storyId}&viewMode=story` : null;
};

export const getStorybookDeepLink = (item: AtlasStorybookEvidence) => {
  const baseUrl = getStorybookBaseUrl();
  return baseUrl ? `${baseUrl}/?path=/story/${item.storyId}` : null;
};

export const getAtlasStoryParameters = (item: AtlasStorybookEvidence) => ({
  atlas: {
    activity: item.activity,
    interaction: item.interaction,
    item: item.itemId,
  },
});

export const getStorybookEvidenceById = (id: string) => {
  const item = atlasStorybookEvidence.find(candidate => candidate.id === id);
  if (!item) throw new Error(`Unknown Atlas Storybook evidence: ${id}`);
  return item;
};
