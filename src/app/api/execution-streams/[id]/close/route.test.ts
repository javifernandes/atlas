// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAccessMock = vi.hoisted(() => vi.fn());
const getApplicationMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers: () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/auth/server', () => ({ getAtlasRequestAccess: getAccessMock }));
vi.mock('@/atlas/server/atlas-composition', () => ({
  getAtlasServerApplication: getApplicationMock,
}));

import { POST } from './route';

describe('close execution stream route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated Atlas User', async () => {
    getAccessMock.mockResolvedValue({ viewer: null });

    const response = await POST(
      new Request('https://atlas.test/api/execution-streams/stream-1/close', {
        method: 'POST',
      }),
      { params: { id: 'stream-1' } },
    );

    expect(response.status).toBe(401);
    expect(getApplicationMock).not.toHaveBeenCalled();
  });

  it('passes the authenticated User identity to the Ontahí close operation', async () => {
    const closeExecutionStream = vi.fn().mockResolvedValue({
      id: 'stream-1',
      closed: true,
      closedAt: '2026-09-03T01:00:00.000Z',
    });
    getAccessMock.mockResolvedValue({ viewer: { id: 'user-1' } });
    getApplicationMock.mockResolvedValue({ closeExecutionStream });

    const response = await POST(
      new Request('https://atlas.test/api/execution-streams/stream-1/close', {
        method: 'POST',
        headers: { origin: 'https://atlas.test' },
      }),
      { params: { id: 'stream-1' } },
    );

    expect(response.status).toBe(200);
    expect(closeExecutionStream).toHaveBeenCalledWith({
      id: 'stream-1',
      userId: 'user-1',
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/');
  });

  it('rejects a cross-origin close request', async () => {
    const response = await POST(
      new Request('https://atlas.test/api/execution-streams/stream-1/close', {
        method: 'POST',
        headers: { origin: 'https://attacker.test' },
      }),
      { params: { id: 'stream-1' } },
    );

    expect(response.status).toBe(403);
    expect(getAccessMock).not.toHaveBeenCalled();
  });
});
