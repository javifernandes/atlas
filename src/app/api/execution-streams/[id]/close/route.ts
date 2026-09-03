import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { getAtlasRequestAccess } from '@/auth/server';
import { getAtlasServerApplication } from '@/atlas/server/atlas-composition';

export const dynamic = 'force-dynamic';

export const POST = async (
  request: Request,
  { params }: { params: { id: string } },
) => {
  const origin = request.headers.get('origin');

  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const access = await getAtlasRequestAccess(headers());

  if (!access.viewer) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const atlas = await getAtlasServerApplication();
  const result = await atlas.closeExecutionStream({
    id: params.id,
    userId: access.viewer.id,
  });

  if (!result.closed) {
    return Response.json({ error: 'Execution stream not found.' }, { status: 404 });
  }

  revalidatePath('/');

  return Response.json(result);
};
