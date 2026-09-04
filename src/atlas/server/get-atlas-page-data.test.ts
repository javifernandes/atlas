import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import { getAtlasServerApplication } from './atlas-composition';
import { getAtlasPageData } from './get-atlas-page-data';

vi.mock('./atlas-composition', () => ({
  getAtlasServerApplication: vi.fn(),
}));

const getApplication = vi.mocked(getAtlasServerApplication);

describe('Atlas page data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
