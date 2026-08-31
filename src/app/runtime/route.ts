import type { RuntimeProtocolError } from '@ontahi/core/runtime/protocol';

import { dispatchAtlasRuntimeRequest } from '@/atlas/server/atlas-runtime';

export const dynamic = 'force-dynamic';

const getProtocolErrorStatus = (response: RuntimeProtocolError) => {
  switch (response.error.code) {
    case 'invalid_envelope':
    case 'invalid_family_request':
    case 'unknown_family':
    case 'unsupported_version':
      return 400;
    case 'family_unavailable':
      return 404;
    case 'dispatch_unavailable':
      return 503;
    case 'invalid_response':
      return 502;
  }
};

export const POST = async (request: Request) => {
  const body: unknown = await request.json().catch(() => null);
  const response = await dispatchAtlasRuntimeRequest(body, {});

  return Response.json(response, {
    status: response.kind === 'protocol-error' ? getProtocolErrorStatus(response) : 200,
  });
};
