import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasRequestAccessMock = vi.hoisted(() => vi.fn());
const getAtlasPageDataMock = vi.hoisted(() => vi.fn());
const listAtlasWorkspacesForUserMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers: () => new Headers() }));
vi.mock('@/auth/server', () => ({ getAtlasRequestAccess: getAtlasRequestAccessMock }));
vi.mock('@/atlas/server/get-atlas-page-data', () => ({
  getAtlasPageData: getAtlasPageDataMock,
}));
vi.mock('@/atlas/workspace/workspace-access', () => ({
  listAtlasWorkspacesForUser: listAtlasWorkspacesForUserMock,
}));
vi.mock('@/components/workspace/workspace-onboarding', () => ({
  WorkspaceOnboarding: ({ userName }: { userName: string }) => <div>Create a Workspace, {userName}</div>,
}));
vi.mock('@/components/atlas-explorer-client', () => ({
  AtlasExplorerClient: ({ isAuthenticated }: { isAuthenticated: boolean }) => (
    <div data-authenticated={String(isAuthenticated)}>Atlas workspace</div>
  ),
}));
vi.mock('@/components/auth/auth-control', () => ({
  AuthControl: ({ variant }: { variant?: string }) => (
    <button type='button'>{variant === 'sign-in' ? 'Continue with GitHub' : 'Sign out'}</button>
  ),
}));

import AtlasPage from './page';

const viewer = {
  email: 'javi@example.com',
  id: 'atlas-user-1',
  image: null,
  name: 'Javi',
};

describe('Atlas page access wall', () => {
  beforeEach(() => {
    getAtlasRequestAccessMock.mockReset();
    getAtlasPageDataMock.mockReset().mockResolvedValue({
      executionStreams: [],
      snapshot: {},
    });
    listAtlasWorkspacesForUserMock.mockReset().mockResolvedValue([{
      id: 'workspace-1', name: 'Atlas', role: 'owner', slug: 'atlas', visibility: 'private',
    }]);
  });

  it('renders the login landing without loading projection data for an anonymous visitor', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: false,
      configurationError: null,
      principal: null,
      viewer: null,
      visibility: 'private',
    });

    render(await AtlasPage({}));

    expect(screen.getByRole('heading', { name: 'Enter Atlas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();
    expect(screen.queryByText('Atlas workspace')).not.toBeInTheDocument();
    expect(getAtlasPageDataMock).not.toHaveBeenCalled();
  });

  it('renders the Workspace home after authentication', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: true,
      configurationError: null,
      principal: { issuer: 'atlas', kind: 'user', subject: viewer.id },
      viewer,
      visibility: 'private',
    });

    render(await AtlasPage({}));
    expect(screen.getByRole('heading', { name: 'Your Workspaces' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Atlas/ })).toHaveAttribute('href', '/w/atlas');
    expect(screen.getByRole('link', { name: 'Create Workspace' })).toHaveAttribute(
      'href',
      '/workspaces/new',
    );
    expect(getAtlasPageDataMock).not.toHaveBeenCalled();
  });

  it('retains the explicit anonymous public bypass for local development', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: false,
      canRead: true,
      configurationError: null,
      principal: null,
      viewer: null,
      visibility: 'public',
    });

    render(await AtlasPage({}));

    expect(screen.getByText('Atlas workspace')).toBeInTheDocument();
    expect(screen.getByText('Atlas workspace')).toHaveAttribute('data-authenticated', 'false');
    expect(getAtlasPageDataMock).toHaveBeenCalledWith(undefined, undefined);
  });

  it('shows onboarding to an authenticated User without Memberships', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: true,
      configurationError: null,
      principal: { issuer: 'atlas', kind: 'user', subject: viewer.id },
      viewer,
      visibility: 'private',
    });
    listAtlasWorkspacesForUserMock.mockResolvedValue([]);

    render(await AtlasPage({}));

    expect(screen.getByText('Create a Workspace, Javi')).toBeInTheDocument();
    expect(getAtlasPageDataMock).not.toHaveBeenCalled();
  });
});
