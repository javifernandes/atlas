import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasRequestAccessMock = vi.hoisted(() => vi.fn());
const listAtlasWorkspacesForUserMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
}));

vi.mock('next/headers', () => ({ headers: () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/auth/server', () => ({ getAtlasRequestAccess: getAtlasRequestAccessMock }));
vi.mock('@/atlas/workspace/workspace-access', () => ({
  listAtlasWorkspacesForUser: listAtlasWorkspacesForUserMock,
}));
vi.mock('@/components/auth/auth-control', () => ({
  AuthControl: () => <button type='button'>Sign in</button>,
}));
vi.mock('@/components/workspace/workspace-onboarding', () => ({
  WorkspaceOnboarding: ({ userName }: { userName: string }) => <div>Create Workspace for {userName}</div>,
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
    redirectMock.mockClear();
    listAtlasWorkspacesForUserMock.mockReset().mockResolvedValue([
      { id: 'workspace-1', name: 'Atlas', role: 'owner', slug: 'atlas', visibility: 'private' },
    ]);
  });

  it('redirects the legacy settings route into the selected Workspace', async () => {
    await expect(WorkspaceSettingsPage()).rejects.toThrow('redirect:/w/atlas/settings');
    expect(redirectMock).toHaveBeenCalledWith('/w/atlas/settings');
  });

  it('keeps unauthenticated requests outside the Graph-backed settings client', async () => {
    getAtlasRequestAccessMock.mockResolvedValue({
      authAvailable: true,
      canRead: false,
      configurationError: null,
      principal: null,
      viewer: null,
      visibility: 'private',
    });

    render(await WorkspaceSettingsPage());

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
