// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { POST } from './route';

describe('Atlas Runtime Protocol route', () => {
  it('maps an invalid envelope to a protocol-aware HTTP response', async () => {
    const response = await POST(
      new Request('http://atlas.test/runtime', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      protocol: 'ontahi.runtime',
      version: 1,
      kind: 'protocol-error',
      error: { code: 'invalid_envelope' },
    });
  });
});
