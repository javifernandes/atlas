import { toNextJsHandler } from 'better-auth/next-js';

import { AtlasAuthConfigurationError, getAtlasAuth } from '@/auth/server';

const unavailable = (error: unknown) =>
  Response.json(
    {
      error:
        error instanceof AtlasAuthConfigurationError
          ? error.message
          : 'Atlas authentication is unavailable.',
    },
    { status: 503 },
  );

const handle = async (request: Request) => {
  try {
    return await getAtlasAuth().handler(request);
  } catch (error) {
    return unavailable(error);
  }
};

export const { DELETE, GET, PATCH, POST, PUT } = toNextJsHandler(handle);
