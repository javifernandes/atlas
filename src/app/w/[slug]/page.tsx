import { headers } from 'next/headers';

import { getAtlasPageData } from '@/atlas/server/get-atlas-page-data';
import { readAtlasModelConfiguration } from '@/atlas/server/model-provider';
import {
  getAtlasWorkspaceForUser,
  listAtlasWorkspacesForUser,
} from '@/atlas/workspace/workspace-access';
import {
  listAtlasWorkspaceSources,
  listAtlasWorkspaceSyncRuns,
} from '@/atlas/workspace/workspace-task-runs';
import { getAtlasRequestAccess } from '@/auth/server';
import { AtlasExplorerClient } from '@/components/atlas-explorer-client';
import { AuthControl } from '@/components/auth/auth-control';
import { AuthLanding } from '@/components/auth/auth-landing';
import { PlanAssistant } from '@/components/plan-assistant';
import { WorkspaceAccessDenied } from '@/components/workspace/workspace-access-denied';
import { WorkspaceControl } from '@/components/workspace/workspace-control';
import { WorkspaceEmptyState } from '@/components/workspace/workspace-empty-state';
import { WorkspaceSyncActivity } from '@/components/workspace/workspace-sync-activity';
import type { PlanWorkstreamSnapshot } from '@/atlas/model/snapshot';

export const dynamic = 'force-dynamic';

type WorkspacePageProps = {
  params: { slug: string };
  searchParams?: { session?: string | string[] };
};

const importingWorkspaceSnapshot = (
  workspace: { id: string; name: string },
  sources: Array<{ id: string; repository: string | null; sourceId: string }>,
): PlanWorkstreamSnapshot => ({
  generatedAt: new Date().toISOString(),
  metrics: [],
  territories: [],
  nodes: [
    {
      candidateCount: 0,
      id: `workspace:${workspace.id}`,
      kind: 'root',
      relatedCount: sources.length,
      sections: [],
      shortTitle: workspace.name,
      status: 'importing',
      statusGroup: 'current',
      territory: workspace.name,
      title: workspace.name,
    },
    ...sources.map(source => ({
      candidateCount: 0,
      id: `workspace-source:${source.id}`,
      kind: 'project' as const,
      relatedCount: 1,
      sections: [],
      shortTitle: source.repository ?? source.sourceId,
      sourceId: source.sourceId,
      status: 'importing',
      statusGroup: 'current' as const,
      territory: workspace.name,
      title: source.repository ?? source.sourceId,
    })),
  ],
  edges: sources.map(source => ({
    from: `workspace:${workspace.id}`,
    id: `workspace:${workspace.id}:contains:${source.id}`,
    kind: 'contains',
    to: `workspace-source:${source.id}`,
  })),
});

const withImportingSources = (
  snapshot: PlanWorkstreamSnapshot,
  workspace: { id: string; name: string },
  sources: Array<{ id: string; repository: string | null; sourceId: string }>,
): PlanWorkstreamSnapshot => {
  const representedSourceIds = new Set(
    snapshot.nodes.flatMap(node => node.sourceId ? [node.sourceId] : []),
  );
  const representedRepositories = new Set(
    snapshot.nodes.flatMap(node =>
      node.sourceRepository ? [node.sourceRepository.toLowerCase()] : [],
    ),
  );
  const missingSources = sources.filter(source =>
    !representedSourceIds.has(source.sourceId) &&
    (!source.repository || !representedRepositories.has(source.repository.toLowerCase())),
  );
  if (missingSources.length === 0) return snapshot;

  const root = snapshot.nodes.find(node => node.kind === 'root');
  if (!root) return snapshot;

  return {
    ...snapshot,
    nodes: [
      ...snapshot.nodes,
      ...missingSources.map(source => ({
        candidateCount: 0,
        id: `workspace-source:${source.id}`,
        kind: 'project' as const,
        relatedCount: 1,
        sections: [],
        shortTitle: source.repository ?? source.sourceId,
        sourceId: source.sourceId,
        sourceRepository: source.repository ?? undefined,
        status: 'importing',
        statusGroup: 'current' as const,
        territory: workspace.name,
        title: source.repository ?? source.sourceId,
      })),
    ],
    edges: [
      ...snapshot.edges,
      ...missingSources.map(source => ({
        from: root.id,
        id: `${root.id}:contains:${source.id}`,
        kind: 'contains' as const,
        to: `workspace-source:${source.id}`,
      })),
    ],
  };
};

const WorkspacePage = async ({ params, searchParams }: WorkspacePageProps) => {
  const access = await getAtlasRequestAccess(headers());
  if (!access.canRead || !access.viewer) {
    return (
      <AuthLanding
        authAvailable={access.authAvailable}
        configurationError={access.configurationError}
        viewer={access.viewer}
      />
    );
  }

  const [workspace, workspaces] = await Promise.all([
    getAtlasWorkspaceForUser(access.viewer.id, params.slug),
    listAtlasWorkspacesForUser(access.viewer.id),
  ]);
  if (!workspace) return <WorkspaceAccessDenied viewer={access.viewer} />;

  const selectedStreamId = Array.isArray(searchParams?.session)
    ? searchParams.session[0]
    : searchParams?.session;
  const [{ executionStreams, snapshot }, syncRuns, sources] = await Promise.all([
    getAtlasPageData(access.viewer.id, selectedStreamId, workspace.id),
    listAtlasWorkspaceSyncRuns(workspace.id),
    listAtlasWorkspaceSources(workspace.id),
  ]);

  const projectionIsEmpty =
    snapshot.nodes.length <= 1 &&
    !snapshot.documents?.length;

  if (projectionIsEmpty && sources.length === 0) {
    return (
      <>
        <WorkspaceEmptyState workspace={workspace} workspaces={workspaces} />
        <WorkspaceSyncActivity runs={syncRuns} />
      </>
    );
  }

  const latestSync = syncRuns[0];
  const syncIsActive = latestSync
    ? latestSync.status === 'queued' ||
      latestSync.status === 'running' ||
      latestSync.status === 'waiting'
    : false;
  const visibleSnapshot = projectionIsEmpty
    ? importingWorkspaceSnapshot(workspace, sources)
    : syncIsActive
      ? withImportingSources(snapshot, workspace, sources)
      : snapshot;

  return (
    <>
      <AtlasExplorerClient
        executionStreams={executionStreams}
        isAuthenticated
        snapshot={visibleSnapshot}
      />
      <AuthControl
        authAvailable={access.authAvailable}
        className='fixed right-4 top-4 z-50'
        viewer={access.viewer}
      />
      <WorkspaceControl workspace={workspace} workspaces={workspaces} />
      {readAtlasModelConfiguration().enabled ? (
        <PlanAssistant workspaceId={workspace.id} />
      ) : null}
      <WorkspaceSyncActivity runs={syncRuns} />
    </>
  );
};

export default WorkspacePage;
