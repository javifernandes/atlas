import { createNextRuntimeProtocolRouteHandler } from '@ontahi/runtime-nextjs/runtime-protocol';

import { getAtlasServerApplication } from '@/atlas/server/atlas-composition';
import { getAtlasRuntimeInvocationContext } from '@/auth/server';

export const dynamic = 'force-dynamic';

export const POST = createNextRuntimeProtocolRouteHandler({
  receiver: async () => (await getAtlasServerApplication()).runtimeProtocol,
  context: getAtlasRuntimeInvocationContext,
});
