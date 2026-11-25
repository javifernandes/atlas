import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import { getAtlasServerApplication, resolveAtlasStorageMode } from './atlas-composition';
import { getAtlasPageData } from './get-atlas-page-data';

vi.mock('./atlas-composition', () => ({
  getAtlasServerApplication: vi.fn(),
  resolveAtlasStorageMode: vi.fn(),
}));

const getApplication = vi.mocked(getAtlasServerApplication);
const getStorageMode = vi.mocked(resolveAtlasStorageMode);

describe('Atlas page data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStorageMode.mockReturnValue('postgres');
  });

  it('reads one durable projection revision without rebuilding sources', async () => {
    const snapshot: PlanWorkstreamSnapshot = {
      generatedAt: '2026-09-02T00:00:00.000Z',
      nodes: [],
      edges: [],
      evidence: [],
      metrics: [],
      territories: [],
    };
    const getProjectionSnapshot = vi.fn().mockResolvedValue(snapshot);
    const getExecutionStreams = vi.fn().mockResolvedValue([]);
    getApplication.mockResolvedValue({ getExecutionStreams, getProjectionSnapshot } as never);

    await expect(getAtlasPageData('user-1')).resolves.toEqual({
      executionStreams: [],
      snapshot,
    });
    expect(getProjectionSnapshot).toHaveBeenCalledOnce();
    expect(getExecutionStreams).toHaveBeenCalledWith('user-1');
  });

  it('omits Markdown bodies from the initial page projection', async () => {
    const snapshot: PlanWorkstreamSnapshot = {
      generatedAt: '2026-09-02T00:00:00.000Z',
      nodes: [
        {
          id: 'plan:one',
          kind: 'plan',
          markdown: '# Large plan body',
          title: 'Plan one',
          shortTitle: 'Plan one',
          statusGroup: 'current',
          status: 'active',
          territory: 'Atlas',
          sections: [],
          relatedCount: 0,
          candidateCount: 0,
        },
      ],
      documents: [
        {
          id: 'document:one',
          kind: 'concept',
          markdown: '# Large durable body',
          title: 'Document one',
          shortTitle: 'Document one',
          statusGroup: 'current',
          status: 'active',
          territory: 'Atlas',
          sections: [],
          relatedCount: 0,
          candidateCount: 0,
        },
      ],
      edges: [],
      evidence: [],
      metrics: [],
      territories: [],
    };
    getApplication.mockResolvedValue({
      getExecutionStreams: vi.fn().mockResolvedValue([]),
      getProjectionSnapshot: vi.fn().mockResolvedValue(snapshot),
    } as never);

    const result = await getAtlasPageData('user-1');

    expect(result.snapshot.nodes[0]).not.toHaveProperty('markdown');
    expect(result.snapshot.documents?.[0]).not.toHaveProperty('markdown');
    expect(snapshot.nodes[0]).toHaveProperty('markdown', '# Large plan body');
  });

  it('uses a storage-bounded page projection when the application provides one', async () => {
    const pageSnapshot: PlanWorkstreamSnapshot = {
      generatedAt: '2026-10-01T00:00:00.000Z',
      nodes: [],
      edges: [],
      evidence: [],
      metrics: [],
      territories: [],
    };
    const getPageProjectionSnapshot = vi.fn().mockResolvedValue(pageSnapshot);
    const getProjectionSnapshot = vi.fn();
    getApplication.mockResolvedValue({
      getExecutionStreams: vi.fn().mockResolvedValue([]),
      getPageProjectionSnapshot,
      getProjectionSnapshot,
    } as never);

    await expect(getAtlasPageData('user-1')).resolves.toMatchObject({
      snapshot: pageSnapshot,
    });
    expect(getPageProjectionSnapshot).toHaveBeenCalledOnce();
    expect(getProjectionSnapshot).not.toHaveBeenCalled();
  });

  it('uses a storage-bounded Workspace page projection when one is available', async () => {
    const pageSnapshot: PlanWorkstreamSnapshot = {
      generatedAt: '2026-11-17T00:00:00.000Z',
      nodes: [],
      edges: [],
      evidence: [],
      metrics: [],
      territories: [],
    };
    const getWorkspacePageProjection = vi.fn().mockResolvedValue({
      id: 'revision-1',
      snapshot: pageSnapshot,
    });
    const getWorkspaceProjectionSnapshot = vi.fn();
    getApplication.mockResolvedValue({
      getExecutionStreams: vi.fn().mockResolvedValue([]),
      getWorkspacePageProjection,
      getWorkspaceProjectionSnapshot,
    } as never);

    await expect(getAtlasPageData('user-1', null, 'workspace-1')).resolves.toMatchObject({
      snapshot: pageSnapshot,
      workspaceProjectionRevisionId: 'revision-1',
    });
    expect(getWorkspacePageProjection).toHaveBeenCalledWith('workspace-1');
    expect(getWorkspaceProjectionSnapshot).not.toHaveBeenCalled();
  });

  it('bounds a legacy Workspace projection before sending it to the page', async () => {
    const snapshot: PlanWorkstreamSnapshot = {
      generatedAt: '2026-11-17T00:00:00.000Z',
      nodes: [
        {
          id: 'plan:one',
          kind: 'plan',
          markdown: '# Large plan body',
          title: 'Plan one',
          shortTitle: 'Plan one',
          statusGroup: 'current',
          status: 'active',
          territory: 'Atlas',
          sections: [],
          relatedCount: 0,
          candidateCount: 0,
        },
      ],
      edges: [],
      evidence: [],
      metrics: [],
      territories: [],
    };
    getApplication.mockResolvedValue({
      getExecutionStreams: vi.fn().mockResolvedValue([]),
      getWorkspaceProjectionSnapshot: vi.fn().mockResolvedValue(snapshot),
    } as never);

    const result = await getAtlasPageData('user-1', null, 'workspace-1');

    expect(result.snapshot.nodes[0]).not.toHaveProperty('markdown');
  });

  it('prefers the checkout projection over a Workspace revision in memory mode', async () => {
    const workspaceSnapshot: PlanWorkstreamSnapshot = {
      generatedAt: '2026-11-18T00:00:00.000Z',
      nodes: [],
      edges: [],
      evidence: [],
      metrics: [],
      territories: [],
    };
    const checkoutSnapshot: PlanWorkstreamSnapshot = {
      generatedAt: '2026-11-19T00:00:00.000Z',
      nodes: [],
      edges: [],
      evidence: [],
      metrics: [],
      territories: [],
    };

    getStorageMode.mockReturnValue('memory');
    getApplication.mockResolvedValue({
      getExecutionStreams: vi.fn().mockResolvedValue([]),
      getProjectionSnapshot: vi.fn().mockResolvedValue(checkoutSnapshot),
      getWorkspaceProjectionSnapshot: vi.fn().mockResolvedValue(workspaceSnapshot),
    } as never);

    await expect(getAtlasPageData('user-1', null, 'atlas')).resolves.toMatchObject({
      snapshot: checkoutSnapshot,
    });
  });

  it('returns an empty view before the first bootstrap revision exists', async () => {
    getApplication.mockResolvedValue({
      getProjectionSnapshot: vi.fn().mockResolvedValue(null),
    } as never);

    await expect(getAtlasPageData()).resolves.toMatchObject({
      snapshot: {
        nodes: [expect.objectContaining({ id: 'root:planning' })],
        edges: [],
        evidence: [],
      },
      executionStreams: [],
    });
  });

  it('preserves a User stream while the shared projection is unavailable', async () => {
    const executionStreams = [{ id: 'stream-1' }];
    getApplication.mockResolvedValue({
      getExecutionStreams: vi.fn().mockResolvedValue(executionStreams),
      getProjectionSnapshot: vi.fn().mockResolvedValue(null),
    } as never);

    await expect(getAtlasPageData('user-1')).resolves.toMatchObject({ executionStreams });
  });

  it('requests an addressed Session independently from bounded history', async () => {
    const getExecutionStreams = vi.fn().mockResolvedValue([]);
    getApplication.mockResolvedValue({
      getExecutionStreams,
      getProjectionSnapshot: vi.fn().mockResolvedValue(null),
    } as never);

    await getAtlasPageData('user-1', 'archived-stream-1');

    expect(getExecutionStreams).toHaveBeenCalledWith('user-1', {
      selectedStreamId: 'archived-stream-1',
    });
  });
});
