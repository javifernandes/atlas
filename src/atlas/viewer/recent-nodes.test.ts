import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  atlasRecentNodesStorageKey,
  readRecentAtlasNodes,
  recordRecentAtlasNode,
} from './recent-nodes';

describe('recent Atlas nodes', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: () => null,
      length: 0,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage);
  });

  it('keeps the latest location for one node without duplicating it', () => {
    recordRecentAtlasNode({
      href: '/w/atlas?full=item-a',
      id: 'item-a',
      kind: 'interaction',
      title: 'Item A',
      workspaceSlug: 'atlas',
    });
    recordRecentAtlasNode({
      href: '/w/atlas?full=item-a&section=context',
      id: 'item-a',
      kind: 'interaction',
      title: 'Item A',
      workspaceSlug: 'atlas',
    });

    expect(readRecentAtlasNodes()).toMatchObject([
      {
        href: '/w/atlas?full=item-a&section=context',
        id: 'item-a',
        workspaceSlug: 'atlas',
      },
    ]);
  });

  it('ignores malformed persisted state', () => {
    globalThis.localStorage.setItem(atlasRecentNodesStorageKey, '{broken');

    expect(readRecentAtlasNodes()).toEqual([]);
  });
});
