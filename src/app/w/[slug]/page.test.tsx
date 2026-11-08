import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAtlasRequestAccessMock = vi.hoisted(() => vi.fn());
const getAtlasWorkspaceForUserMock = vi.hoisted(() => vi.fn());
const listAtlasWorkspacesForUserMock = vi.hoisted(() => vi.fn());
const getAtlasPageDataMock = vi.hoisted(() => vi.fn());
const listAtlasWorkspaceSyncRunsMock = vi.hoisted(() => vi.fn());
const listAtlasWorkspaceSourcesMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers: () => new Headers() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@ontahi/react/graph', () => ({ useRuntimeTransportCapability: () => undefined }));
vi.mock('@/auth/server', () => ({ getAtlasRequestAccess: getAtlasRequestAccessMock }));
vi.mock('@/atlas/workspace/workspace-access', () => ({
  getAtlasWorkspaceForUser: getAtlasWorkspaceForUserMock,
  listAtlasWorkspacesForUser: listAtlasWorkspacesForUserMock,
}));
vi.mock('@/atlas/server/get-atlas-page-data', () => ({ getAtlasPageData: getAtlasPageDataMock }));
vi.mock('@/atlas/workspace/workspace-task-runs', () => ({
  listAtlasWorkspaceSources: listAtlasWorkspaceSourcesMock,
  listAtlasWorkspaceSyncRuns: listAtlasWorkspaceSyncRunsMock,
}));
vi.mock('@/atlas/server/model-provider', () => ({
  readAtlasModelConfiguration: () => ({ enabled: false }),
}));
vi.mock('@/components/atlas-explorer-client', () => ({
  AtlasExplorerClient: ({ snapshot }: { snapshot: { nodes: Array<{ id: string; status: string; title: string }> } }) => (
    <div>
      Canonical projection
      {snapshot.nodes.map(node => <span key={node.id}>{node.title} · {node.status}</span>)}
    </div>
  ),
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
    listAtlasWorkspaceSyncRunsMock.mockReset().mockResolvedValue([]);
    listAtlasWorkspaceSourcesMock.mockReset().mockResolvedValue([]);
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
    getAtlasPageDataMock.mockResolvedValue({
      executionStreams: [],
      snapshot: {
        documents: [],
        edges: [],
        metrics: [],
        nodes: [
          { id: 'atlas-model', kind: 'item', title: 'Atlas model' },
          { id: 'atlas-plan', kind: 'plan', title: 'Atlas plan' },
        ],
        territories: [],
      },
    });

    render(await WorkspacePage({ params: { slug: 'atlas' } }));

    expect(screen.getByText('Canonical projection')).toBeInTheDocument();
    expect(getAtlasPageDataMock).toHaveBeenCalledWith(viewer.id, undefined, workspace.id);
  });

  it('recovers Workspace sync activity by subject after navigation', async () => {
    const workspace = {
      id: 'workspace-acme', name: 'Acme', role: 'owner', slug: 'acme', visibility: 'private',
    };
    getAtlasWorkspaceForUserMock.mockResolvedValue(workspace);
    listAtlasWorkspacesForUserMock.mockResolvedValue([workspace]);
    listAtlasWorkspaceSyncRunsMock.mockResolvedValue([{
      createdAt: '2026-11-08T12:00:00.000Z',
      runId: 'run-1',
      status: 'running',
      taskId: 'atlas.workspace.reconcile-sources',
      trigger: { cause: 'user_request' },
      updatedAt: '2026-11-08T12:00:01.000Z',
    }]);
    listAtlasWorkspaceSourcesMock.mockResolvedValue([{
      id: 'source-1', repository: 'javifernandes/ontahi', sourceId: 'ontahi',
    }]);

    render(await WorkspacePage({ params: { slug: 'acme' } }));

    expect(screen.getByText('Workspace is syncing')).toBeInTheDocument();
    expect(screen.getByText('javifernandes/ontahi · importing')).toBeInTheDocument();
    expect(screen.queryByText('Connect repository form')).not.toBeInTheDocument();
    expect(listAtlasWorkspaceSyncRunsMock).toHaveBeenCalledWith(workspace.id);
  });

  it('overlays newly registered Sources as importing nodes on the last good projection', async () => {
    const workspace = {
      id: 'workspace-acme', name: 'Acme', role: 'owner', slug: 'acme', visibility: 'private',
    };
    getAtlasWorkspaceForUserMock.mockResolvedValue(workspace);
    listAtlasWorkspacesForUserMock.mockResolvedValue([workspace]);
    getAtlasPageDataMock.mockResolvedValue({
      executionStreams: [],
      snapshot: {
        documents: [], edges: [{ from: 'root', id: 'root:old', kind: 'contains', to: 'old' }], metrics: [],
        nodes: [
          { candidateCount: 0, id: 'root', kind: 'root', relatedCount: 1, sections: [], shortTitle: 'Acme', status: 'semantic-map', statusGroup: 'current', territory: 'Acme', title: 'Acme' },
          { candidateCount: 0, id: 'old', kind: 'project', relatedCount: 1, sections: [], shortTitle: 'Existing', sourceId: 'existing', status: 'current', statusGroup: 'current', territory: 'Acme', title: 'Existing' },
        ],
        territories: [],
      },
    });
    listAtlasWorkspaceSourcesMock.mockResolvedValue([
      { id: 'source-existing', repository: 'acme/existing', sourceId: 'existing' },
      { id: 'source-new', repository: 'acme/new-repo', sourceId: 'new-repo' },
    ]);
    listAtlasWorkspaceSyncRunsMock.mockResolvedValue([{
      createdAt: '2026-11-08T12:00:00.000Z', runId: 'run-2', status: 'running',
      taskId: 'atlas.workspace.reconcile-sources', trigger: { cause: 'user_request' },
      updatedAt: '2026-11-08T12:00:01.000Z',
    }]);

    render(await WorkspacePage({ params: { slug: 'acme' } }));

    expect(screen.getByText('Existing · current')).toBeInTheDocument();
    expect(screen.getByText('acme/new-repo · importing')).toBeInTheDocument();
  });
});
