import { buildPlanWorkstreamSnapshotFromFiles } from '../markdown/build-snapshot';
import type { AtlasExecutionStreamProjection } from '../model/execution-stream';
import type { PlanWorkstreamSnapshot } from '../model/snapshot';
import { withAtlasPostgresQueryContext } from '../persistence/postgres-observability';
import { getAtlasServerApplication, resolveAtlasStorageMode } from './atlas-composition';

export type AtlasPageData = {
  workspaceProjectionRevisionId?: string | null;
  executionStreams: AtlasExecutionStreamProjection[];
  snapshot: PlanWorkstreamSnapshot;
};

const emptyPageData = (): AtlasPageData => ({
  executionStreams: [],
  snapshot: { ...buildPlanWorkstreamSnapshotFromFiles([]), evidence: [] },
});

const omitNodeMarkdown = ({
  markdown: _markdown,
  ...node
}: PlanWorkstreamSnapshot['nodes'][number]) => node;

export const createAtlasPageSnapshot = (
  snapshot: PlanWorkstreamSnapshot,
): PlanWorkstreamSnapshot => ({
  ...snapshot,
  nodes: snapshot.nodes.map(omitNodeMarkdown),
  documents: snapshot.documents?.map(omitNodeMarkdown),
});

export const getAtlasPageData = async (
  userId?: string | null,
  selectedStreamId?: string | null,
  workspaceId?: string | null,
): Promise<AtlasPageData> =>
  withAtlasPostgresQueryContext(
    {
      operation: 'atlas.page.read',
      trigger: userId ? 'authenticated-page' : 'public-page',
    },
    async () => {
      const atlas = await getAtlasServerApplication();
      const hasWorkspaceRevision = Boolean(workspaceId && 'getWorkspacePageProjection' in atlas);
      const [pageProjection, executionStreams] = await Promise.all([
        workspaceId && 'getWorkspacePageProjection' in atlas
          ? atlas.getWorkspacePageProjection(workspaceId)
          : (workspaceId && 'getWorkspacePageProjectionSnapshot' in atlas
          ? atlas.getWorkspacePageProjectionSnapshot(workspaceId)
          : workspaceId && 'getWorkspaceProjectionSnapshot' in atlas
            ? atlas.getWorkspaceProjectionSnapshot(workspaceId).then(value =>
                value ? createAtlasPageSnapshot(value) : null,
              )
            : 'getPageProjectionSnapshot' in atlas
              ? atlas.getPageProjectionSnapshot()
              : atlas.getProjectionSnapshot().then(value =>
                  value ? createAtlasPageSnapshot(value) : null,
                )).then(snapshot => snapshot ? { id: null, snapshot } : null),
        userId
          ? selectedStreamId
            ? atlas.getExecutionStreams(userId, { selectedStreamId })
            : atlas.getExecutionStreams(userId)
          : Promise.resolve([]),
      ]);

      const snapshot =
        workspaceId && resolveAtlasStorageMode() === 'memory' && 'getProjectionSnapshot' in atlas
          ? await atlas.getProjectionSnapshot()
          : pageProjection?.snapshot;

      const data = snapshot
        ? { executionStreams, snapshot }
        : { ...emptyPageData(), executionStreams };
      return hasWorkspaceRevision
        ? { ...data, workspaceProjectionRevisionId: pageProjection?.id ?? null }
        : data;
    },
  );
