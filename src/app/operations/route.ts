import { createNextOperationInvocationRouteHandler } from '@ontahi/runtime-nextjs/operation-invocation';

import { getAtlasRequestAccess } from '@/auth/server';
import { dispatchAtlasBridgeOperationRequest } from '@/atlas/server/atlas-runtime';

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

  return createNextOperationInvocationRouteHandler({
    dispatcher: dispatchAtlasBridgeOperationRequest,
    invocationContext: () => ({ principal: access.principal }),
  })(request);
};
