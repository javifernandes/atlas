import { createNextRuntimeProtocolRouteHandler } from '@ontahi/runtime-nextjs/runtime-protocol';

import { getAtlasRequestAccess } from '@/auth/server';
import { dispatchAtlasRuntimeRequest } from '@/atlas/server/atlas-runtime';

export const dynamic = 'force-dynamic';

const handleRuntimeRequest = createNextRuntimeProtocolRouteHandler({
  dispatcher: dispatchAtlasRuntimeRequest,
  context: async request => {
    const access = await getAtlasRequestAccess(request.headers);
    return { principal: access.principal };
  },
});

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

  return handleRuntimeRequest(request);
};
