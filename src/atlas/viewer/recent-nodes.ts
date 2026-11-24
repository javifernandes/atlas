export const atlasRecentNodesChangedEvent = 'atlas:recent-nodes-changed';
export const atlasSearchRequestedEvent = 'atlas:search-requested';
export const atlasRecentNodesStorageKey = 'atlas.recent-nodes.v1';

export type RecentAtlasNode = {
  href: string;
  id: string;
  kind: string;
  title: string;
  viewedAt: string;
  workspaceSlug: string;
};

const maximumRecentNodes = 12;

const getRecentNodesStorage = () => {
  const storage = globalThis.localStorage;
  return storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function'
    ? storage
    : undefined;
};

export const readRecentAtlasNodes = (): RecentAtlasNode[] => {
  const storage = getRecentNodesStorage();
  if (!storage) return [];

  try {
    const value = JSON.parse(
      storage.getItem(atlasRecentNodesStorageKey) ?? '[]',
    ) as unknown;

    if (!Array.isArray(value)) return [];

    return value.filter(
      (item): item is RecentAtlasNode =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as RecentAtlasNode).href === 'string' &&
        typeof (item as RecentAtlasNode).id === 'string' &&
        typeof (item as RecentAtlasNode).kind === 'string' &&
        typeof (item as RecentAtlasNode).title === 'string' &&
        typeof (item as RecentAtlasNode).viewedAt === 'string' &&
        typeof (item as RecentAtlasNode).workspaceSlug === 'string',
    );
  } catch {
    return [];
  }
};

export const recordRecentAtlasNode = (node: Omit<RecentAtlasNode, 'viewedAt'>) => {
  const storage = getRecentNodesStorage();
  if (!storage) return;

  const next = [
    { ...node, viewedAt: new Date().toISOString() },
    ...readRecentAtlasNodes().filter(
      recent => recent.id !== node.id || recent.workspaceSlug !== node.workspaceSlug,
    ),
  ].slice(0, maximumRecentNodes);

  storage.setItem(atlasRecentNodesStorageKey, JSON.stringify(next));
  globalThis.dispatchEvent(new CustomEvent(atlasRecentNodesChangedEvent, { detail: next }));
};
