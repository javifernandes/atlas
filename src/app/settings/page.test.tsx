import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasRequestAccessMock = vi.hoisted(() => vi.fn());
const getAtlasWorkspaceForUserMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers: () => new Headers() }));
vi.mock('@/auth/server', () => ({ getAtlasRequestAccess: getAtlasRequestAccessMock }));
vi.mock('@/atlas/workspace/workspace-access', () => ({
  getAtlasWorkspaceForUser: getAtlasWorkspaceForUserMock,
}));
vi.mock('@/components/auth/auth-control', () => ({
  AuthControl: () => <button type='button'>Sign in</button>,
}));

import WorkspaceSettingsPage from './page';

describe('Workspace settings page', () => {
  beforeEach(() => {
    getAtlasRequestAccessMock.mockReset().mockResolvedValue({
      authAvailable: true,
      canRead: true,
      configurationError: null,
      principal: { issuer: 'atlas', kind: 'user', subject: 'user-1' },
      viewer: {
        email: 'owner@example.com',
        id: 'user-1',
        image: null,
        name: 'Owner',
      },
      visibility: 'private',
    });
    getAtlasWorkspaceForUserMock.mockReset().mockResolvedValue({
      id: 'workspace-1',
      members: [
        {
          email: 'owner@example.com',
          image: null,
          name: 'Owner',
          role: 'owner',
          userId: 'user-1',
        },
      ],
      name: 'Atlas',
      role: 'owner',
      slug: 'atlas',
      visibility: 'private',
    });
  });

  it('shows Workspace identity, viewer role, and active members', async () => {
    render(await WorkspaceSettingsPage());

    expect(screen.getByRole('heading', { name: 'Atlas' })).toBeInTheDocument();
    expect(screen.getByText('/atlas · private · your role: owner')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
  });

  it('denies a signed-in user without default Workspace membership', async () => {
    getAtlasWorkspaceForUserMock.mockResolvedValue(null);

    render(await WorkspaceSettingsPage());

    expect(screen.getByRole('heading', { name: 'No active membership' })).toBeInTheDocument();
  });
});
