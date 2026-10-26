import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasRequestAccessMock = vi.hoisted(() => vi.fn());
const getAtlasPageDataMock = vi.hoisted(() => vi.fn());
const getAtlasWorkspaceForUserMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers: () => new Headers() }));
vi.mock('@/auth/server', () => ({ getAtlasRequestAccess: getAtlasRequestAccessMock }));
vi.mock('@/atlas/server/get-atlas-page-data', () => ({
  getAtlasPageData: getAtlasPageDataMock,
}));
vi.mock('@/atlas/workspace/workspace-access', () => ({
  getAtlasWorkspaceForUser: getAtlasWorkspaceForUserMock,
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
    getAtlasWorkspaceForUserMock.mockReset().mockResolvedValue({
      id: 'workspace-1',
      members: [],
      name: 'Atlas',
      role: 'owner',
      slug: 'atlas',
      visibility: 'private',
    });
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

  it('loads Atlas at the same URL after authentication', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: true,
      configurationError: null,
      principal: { issuer: 'atlas', kind: 'user', subject: viewer.id },
      viewer,
      visibility: 'private',
    });

    render(await AtlasPage({}));

    expect(screen.getByText('Atlas workspace')).toBeInTheDocument();
    expect(screen.getByText('Atlas workspace')).toHaveAttribute('data-authenticated', 'true');
    expect(screen.queryByRole('heading', { name: 'Enter Atlas' })).not.toBeInTheDocument();
    expect(getAtlasPageDataMock).toHaveBeenCalledWith(viewer.id, undefined);
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

  it('denies an authenticated non-member before loading projection data', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: true,
      configurationError: null,
      principal: { issuer: 'atlas', kind: 'user', subject: viewer.id },
      viewer,
      visibility: 'private',
    });
    getAtlasWorkspaceForUserMock.mockResolvedValue(null);

    render(await AtlasPage({}));

    expect(screen.getByRole('heading', { name: 'No active membership' })).toBeInTheDocument();
    expect(getAtlasPageDataMock).not.toHaveBeenCalled();
  });
});
