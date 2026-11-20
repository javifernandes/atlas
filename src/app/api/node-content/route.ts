import { getAtlasRequestAccess } from '@/auth/server';
import { getAtlasServerApplication } from '@/atlas/server/atlas-composition';
import { getAtlasWorkspaceForUser } from '@/atlas/workspace/workspace-access';

export const dynamic = 'force-dynamic';

export const GET = async (request: Request) => {
  const access = await getAtlasRequestAccess(request.headers);

  if (!access.canRead) {
    return Response.json(
      {
        error: access.configurationError ? 'atlas_auth_misconfigured' : 'not_authenticated',
        message: access.configurationError ?? 'Sign in to access this private Atlas.',
      },
      { status: access.configurationError ? 503 : 401 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const nodeId = searchParams.get('nodeId');
  const workspaceSlug = searchParams.get('workspace');

  if (!nodeId) {
    return Response.json({ error: 'missing_node_id' }, { status: 400 });
  }

  const workspace = workspaceSlug && access.viewer
    ? await getAtlasWorkspaceForUser(access.viewer.id, workspaceSlug)
    : null;
  if (workspaceSlug && !workspace) {
    return Response.json({ error: 'workspace_not_found' }, { status: 404 });
  }

  const atlas = await getAtlasServerApplication();
  const markdown =
    'getProjectionNodeContent' in atlas
      ? await atlas.getProjectionNodeContent(nodeId, workspace?.id)
      : await atlas.getProjectionSnapshot().then(snapshot => {
          const node = [...(snapshot?.nodes ?? []), ...(snapshot?.documents ?? [])].find(
            candidate => candidate.id === nodeId,
          );

          return node ? (node.markdown ?? '') : null;
        });

  if (markdown === null) {
    return Response.json({ error: 'node_not_found' }, { status: 404 });
  }

  return Response.json({ markdown });
};
