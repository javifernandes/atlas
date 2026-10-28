import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasRequestAccessMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers: () => new Headers() }));
vi.mock('@/auth/server', () => ({ getAtlasRequestAccess: getAtlasRequestAccessMock }));
vi.mock('@/components/auth/auth-control', () => ({
  AuthControl: () => <button type='button'>Sign in</button>,
}));
vi.mock('@/components/workspace/workspace-settings', () => ({
  WorkspaceSettings: ({ viewer }: { viewer: { email: string } }) => (
    <div>Graph settings for {viewer.email}</div>
  ),
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
  });

  it('hands the authenticated viewer to the Graph-backed settings client', async () => {
    render(await WorkspaceSettingsPage());

    expect(screen.getByText('Graph settings for owner@example.com')).toBeInTheDocument();
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
    expect(screen.queryByText(/Graph settings for/)).not.toBeInTheDocument();
  });
});
