import { getAtlasRequestAccess } from '@/auth/server';
import { getAtlasServerApplication } from '@/atlas/server/atlas-composition';

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

  const nodeId = new URL(request.url).searchParams.get('nodeId');

  if (!nodeId) {
    return Response.json({ error: 'missing_node_id' }, { status: 400 });
  }

  const atlas = await getAtlasServerApplication();
  const snapshot = await atlas.getProjectionSnapshot();
  const node = [...(snapshot?.nodes ?? []), ...(snapshot?.documents ?? [])].find(
    candidate => candidate.id === nodeId,
  );

  if (!node) {
    return Response.json({ error: 'node_not_found' }, { status: 404 });
  }

  return Response.json({ markdown: node.markdown ?? '' });
};
