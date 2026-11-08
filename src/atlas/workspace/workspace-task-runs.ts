import type { TaskRunListItem } from '@ontahi/core/runtime/server';

import { getAtlasServerApplication } from '../server/atlas-composition';

export type AtlasWorkspaceSyncRun = Pick<
  TaskRunListItem,
  | 'completedAt'
  | 'createdAt'
  | 'error'
  | 'progress'
  | 'runId'
  | 'startedAt'
  | 'status'
  | 'taskId'
  | 'trigger'
  | 'updatedAt'
>;

export const listAtlasWorkspaceSyncRuns = async (
  workspaceId: string,
): Promise<AtlasWorkspaceSyncRun[]> => {
  const atlas = await getAtlasServerApplication();
  return atlas.listWorkspaceSourceTaskRuns(workspaceId, { limit: 10 });
};

export const listAtlasWorkspaceSources = async (workspaceId: string) => {
  const atlas = await getAtlasServerApplication();
  return atlas.listWorkspaceSources(workspaceId);
};
