import { createNextRuntimeProtocolRouteHandler } from '@ontahi/runtime-nextjs/runtime-protocol';

import { getAtlasRequestAccess } from '@/auth/server';
import { dispatchAtlasRuntimeRequest } from '@/atlas/server/atlas-runtime';
import { getAtlasWorkspaceForUser } from '@/atlas/workspace/workspace-access';

export const dynamic = 'force-dynamic';

export const POST = async (request: Request) => {
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

  if (
    access.visibility === 'private'
    && access.viewer
    && !(await getAtlasWorkspaceForUser(access.viewer.id))
  ) {
    return Response.json(
      {
        error: 'not_authorized',
        message: 'An active Workspace membership is required.',
      },
      { status: 403 },
    );
  }

  return createNextRuntimeProtocolRouteHandler({
    dispatcher: dispatchAtlasRuntimeRequest,
    context: () => ({ principal: access.principal }),
  })(request);
};
