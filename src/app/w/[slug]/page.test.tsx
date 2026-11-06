import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasRequestAccessMock = vi.hoisted(() => vi.fn());
const getAtlasWorkspaceForUserMock = vi.hoisted(() => vi.fn());
const listAtlasWorkspacesForUserMock = vi.hoisted(() => vi.fn());
const getAtlasPageDataMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers: () => new Headers() }));
vi.mock('@/auth/server', () => ({ getAtlasRequestAccess: getAtlasRequestAccessMock }));
vi.mock('@/atlas/workspace/workspace-access', () => ({
  DEFAULT_ATLAS_WORKSPACE_ID: '00000000-0000-4000-8000-000000000137',
  getAtlasWorkspaceForUser: getAtlasWorkspaceForUserMock,
  listAtlasWorkspacesForUser: listAtlasWorkspacesForUserMock,
}));
vi.mock('@/atlas/server/get-atlas-page-data', () => ({ getAtlasPageData: getAtlasPageDataMock }));
vi.mock('@/atlas/server/model-provider', () => ({
  readAtlasModelConfiguration: () => ({ enabled: false }),
}));
vi.mock('@/components/atlas-explorer-client', () => ({
  AtlasExplorerClient: () => <div>Canonical projection</div>,
}));
vi.mock('@/components/workspace/workspace-control', () => ({ WorkspaceControl: () => null }));
vi.mock('@/components/workspace/workspace-source-connection', () => ({
  WorkspaceSourceConnection: () => <div>Connect repository form</div>,
}));

import WorkspacePage from './page';

const viewer = { email: 'ada@example.com', id: 'user-1', image: null, name: 'Ada' };
const access = {
  authAvailable: true,
  canRead: true,
  configurationError: null,
  principal: { issuer: 'atlas', kind: 'user', subject: viewer.id },
  viewer,
  visibility: 'private',
};

describe('dynamic Workspace page', () => {
  beforeEach(() => {
    getAtlasRequestAccessMock.mockReset().mockResolvedValue(access);
    getAtlasWorkspaceForUserMock.mockReset();
    listAtlasWorkspacesForUserMock.mockReset().mockResolvedValue([]);
    getAtlasPageDataMock.mockReset().mockResolvedValue({
      executionStreams: [],
      snapshot: { documents: [], edges: [], metrics: [], nodes: [], territories: [] },
    });
  });

  it('does not expose the canonical projection to an empty dynamic Workspace', async () => {
    const workspace = {
      id: 'workspace-acme', name: 'Acme', role: 'owner', slug: 'acme', visibility: 'private',
    };
    getAtlasWorkspaceForUserMock.mockResolvedValue(workspace);
    listAtlasWorkspacesForUserMock.mockResolvedValue([workspace]);

    render(await WorkspacePage({ params: { slug: 'acme' } }));

    expect(screen.getByRole('heading', { name: 'Acme' })).toBeInTheDocument();
    expect(screen.getByText('Connect repository form')).toBeInTheDocument();
    expect(getAtlasPageDataMock).toHaveBeenCalledWith(viewer.id, undefined, workspace.id);
  });

  it('denies a slug without an active Membership', async () => {
    getAtlasWorkspaceForUserMock.mockResolvedValue(null);

    render(await WorkspacePage({ params: { slug: 'someone-elses' } }));

    expect(screen.getByRole('heading', { name: 'No active membership' })).toBeInTheDocument();
    expect(getAtlasPageDataMock).not.toHaveBeenCalled();
  });

  it('keeps the migrated Atlas projection on its canonical Workspace', async () => {
    const workspace = {
      id: '00000000-0000-4000-8000-000000000137',
      name: 'Atlas', role: 'owner', slug: 'atlas', visibility: 'private',
    };
    getAtlasWorkspaceForUserMock.mockResolvedValue(workspace);
    listAtlasWorkspacesForUserMock.mockResolvedValue([workspace]);

    render(await WorkspacePage({ params: { slug: 'atlas' } }));

    expect(screen.getByText('Canonical projection')).toBeInTheDocument();
    expect(getAtlasPageDataMock).toHaveBeenCalledWith(viewer.id, undefined, null);
  });
});
