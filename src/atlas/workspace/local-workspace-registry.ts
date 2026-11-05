import type { AtlasWorkspaceAccess } from './workspace-access';

type LocalWorkspaceRegistryState = {
  byUser: Map<string, AtlasWorkspaceAccess[]>;
};

const root = globalThis as typeof globalThis & {
  __atlasLocalWorkspaceRegistry?: LocalWorkspaceRegistryState;
};

const state: LocalWorkspaceRegistryState = (root.__atlasLocalWorkspaceRegistry ??= {
  byUser: new Map<string, AtlasWorkspaceAccess[]>(),
});

export const registerLocalWorkspace = (userId: string, workspace: AtlasWorkspaceAccess) => {
  const current = state.byUser.get(userId) ?? [];
  state.byUser.set(userId, [
    ...current.filter(candidate => candidate.id !== workspace.id),
    workspace,
  ]);
};

export const listLocalWorkspaces = (userId: string) => state.byUser.get(userId) ?? [];

export const unregisterLocalWorkspace = (userId: string, workspaceId: string) => {
  const remaining = (state.byUser.get(userId) ?? []).filter(
    workspace => workspace.id !== workspaceId,
  );
  if (remaining.length === 0) state.byUser.delete(userId);
  else state.byUser.set(userId, remaining);
};
