import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  getAtlasStoryParameters,
  getStorybookEvidenceById,
} from '@/atlas/evidence/storybook-evidence';
import { AuthLanding } from './auth-landing';

const evidenceParameters = (id: string) =>
  getAtlasStoryParameters(getStorybookEvidenceById(id));

const meta = {
  title: 'Interactions/Respond to Workspace Invitation/Authentication',
  component: AuthLanding,
  args: {
    authAvailable: true,
    callbackURL: '/invitations/invitation-demo',
    configurationError: null,
    errorCallbackURL: '/invitations/invitation-demo',
    viewer: null,
  },
  parameters: evidenceParameters('sign-in-to-respond'),
} satisfies Meta<typeof AuthLanding>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignInToRespond: Story = {
  parameters: evidenceParameters('sign-in-to-respond'),
};

export const AuthenticationRejected: Story = {
  args: {
    error: 'access_denied',
  },
  parameters: evidenceParameters('authentication-rejected'),
};

export const AuthenticationUnavailable: Story = {
  args: {
    authAvailable: false,
    configurationError: 'GitHub authentication is not configured for this deployment.',
  },
  parameters: evidenceParameters('authentication-unavailable'),
};
