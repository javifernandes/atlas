// @vitest-environment node

import { getCurrentPrincipal } from '@ontahi/core/runtime/server';
import { describe, expect, it } from 'vitest';

import { withAtlasRuntimeRequestContext } from './atlas-runtime';

describe('Atlas Runtime Protocol identity', () => {
  it('makes the request Principal visible to Ontahí execution', async () => {
    const principal = {
      issuer: 'atlas',
      kind: 'user' as const,
      subject: 'github-user-1',
    };

    await expect(
      withAtlasRuntimeRequestContext({ principal }, async () => getCurrentPrincipal()),
    ).resolves.toEqual(principal);
  });

  it('preserves an explicit anonymous request context', () => {
    expect(withAtlasRuntimeRequestContext({ principal: null }, () => getCurrentPrincipal())).toBe(
      null,
    );
  });
});
