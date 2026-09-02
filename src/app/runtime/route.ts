import { createNextRuntimeProtocolRouteHandler } from '@ontahi/runtime-nextjs/runtime-protocol';

import { dispatchAtlasRuntimeRequest } from '@/atlas/server/atlas-runtime';

export const dynamic = 'force-dynamic';

export const POST = createNextRuntimeProtocolRouteHandler({
  dispatcher: dispatchAtlasRuntimeRequest,
  context: () => ({}),
});
