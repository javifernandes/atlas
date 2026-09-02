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
    getApplication.mockResolvedValue({ getProjectionSnapshot } as never);

    await expect(getAtlasPageData()).resolves.toEqual({ snapshot });
    expect(getProjectionSnapshot).toHaveBeenCalledOnce();
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
    });
  });
});
