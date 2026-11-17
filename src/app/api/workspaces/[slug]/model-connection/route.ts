import { randomUUID } from 'node:crypto';

import { withInvocationContext } from '@ontahi/core/runtime/server';
import { revalidatePath } from 'next/cache';

import { atlasWorkspaceRef } from '@/atlas/model/workspace-administration';
import type { AtlasWorkspaceModelConnection } from '@/atlas/model/workspace-model-connection';
import { getAtlasServerApplication } from '@/atlas/server/atlas-composition';
import { listAtlasProviderModels } from '@/atlas/server/model-catalog';
import { readAtlasModelConfiguration } from '@/atlas/server/model-provider';
import {
  createAtlasSecretStore,
  readAtlasSecretStoreConfiguration,
} from '@/atlas/server/secret-store';
import { atlasSecretReference } from '@/atlas/secrets/secret-store';
import { getAtlasWorkspaceForUser } from '@/atlas/workspace/workspace-access';
import { getAtlasRequestAccess } from '@/auth/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { slug: string } };

const safeConnection = (connection: AtlasWorkspaceModelConnection | null) => {
  const secretStore = readAtlasSecretStoreConfiguration();
  return {
  connection: connection
    ? {
        baseUrl: connection.baseUrl,
        model: connection.model,
        provider: connection.provider,
        secretSuffix: connection.secretSuffix,
        status: connection.status,
      }
    : null,
  deploymentFallback: readAtlasModelConfiguration(),
    secretStore: { available: secretStore.available, provider: secretStore.provider },
  };
};

const authorizeOwner = async (request: Request, slug: string) => {
  const access = await getAtlasRequestAccess(request.headers);
  if (!access.canRead || !access.viewer || !access.principal) {
    return { ok: false as const, response: Response.json({ message: 'Sign in to manage this Workspace.' }, { status: 401 }) };
  }
  const workspace = await getAtlasWorkspaceForUser(access.viewer.id, slug);
  if (!workspace || workspace.role !== 'owner') {
    return { ok: false as const, response: Response.json({ message: 'Only a Workspace owner can manage models.' }, { status: 403 }) };
  }
  return { ok: true as const, access, workspace };
};

const invoke = async (
  principal: NonNullable<Awaited<ReturnType<typeof getAtlasRequestAccess>>['principal']>,
  operationName: 'configureModelConnection' | 'disableModelConnection' | 'readModelConnection',
  input: Record<string, unknown>,
) => {
  const atlas = await getAtlasServerApplication();
  const operation = atlas.application.graph.entities.AtlasWorkspace.domain[operationName];
  return withInvocationContext({ principal }, () =>
    atlas.application.invokeOperation(operation as never, input as never),
  );
};

const readConnection = async (principal: NonNullable<Awaited<ReturnType<typeof getAtlasRequestAccess>>['principal']>, workspaceId: string) => {
  const result = await invoke(principal, 'readModelConnection', {
    workspace: atlasWorkspaceRef(workspaceId),
  });
  return result.ok ? result.value as AtlasWorkspaceModelConnection | null : null;
};

export const GET = async (request: Request, { params }: RouteContext) => {
  const authorization = await authorizeOwner(request, params.slug);
  if (!authorization.ok) return authorization.response;
  const connection = await readConnection(authorization.access.principal!, authorization.workspace.id);
  return Response.json(safeConnection(connection));
};

export const POST = async (request: Request, { params }: RouteContext) => {
  const authorization = await authorizeOwner(request, params.slug);
  if (!authorization.ok) return authorization.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const provider = body?.provider;
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
  if (
    (provider !== 'openai' && provider !== 'anthropic' && provider !== 'deepseek') ||
    apiKey.length < 8 || apiKey.length > 10_000
  ) {
    return Response.json({ message: 'Provider and API key are required.' }, { status: 400 });
  }
  try {
    return Response.json({ models: await listAtlasProviderModels({ apiKey, provider }) });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : 'Models could not be loaded.' },
      { status: 502 },
    );
  }
};

export const PUT = async (request: Request, { params }: RouteContext) => {
  const authorization = await authorizeOwner(request, params.slug);
  if (!authorization.ok) return authorization.response;
  const secretStore = createAtlasSecretStore();
  if (!secretStore) {
    return Response.json(
      { message: 'Workspace secret storage is not configured on this Atlas host.' },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const provider = body?.provider;
  const model = typeof body?.model === 'string' ? body.model.trim() : '';
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
  const baseUrlValue = typeof body?.baseUrl === 'string' ? body.baseUrl.trim() : '';
  if (
    (provider !== 'openai' && provider !== 'anthropic' && provider !== 'deepseek') ||
    model.length === 0 || model.length > 200 ||
    apiKey.length < 8 || apiKey.length > 10_000
  ) {
    return Response.json({ message: 'Provider, model, and API key are required.' }, { status: 400 });
  }
  if (baseUrlValue) {
    try {
      const url = new URL(baseUrlValue);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    } catch {
      return Response.json({ message: 'The optional base URL must be an HTTP URL.' }, { status: 400 });
    }
  }

  const principal = authorization.access.principal!;
  const previous = await readConnection(principal, authorization.workspace.id);
  const reference = atlasSecretReference(
    `ATLAS_MODEL_CONNECTION_${randomUUID().replaceAll('-', '_').toUpperCase()}`,
  );
  try {
    await secretStore.put(reference, apiKey);
  } catch {
    return Response.json({ message: 'The credential could not be stored.' }, { status: 502 });
  }

  const result = await invoke(principal, 'configureModelConnection', {
    workspace: atlasWorkspaceRef(authorization.workspace.id),
    provider,
    model,
    baseUrl: baseUrlValue || null,
    secretRef: reference,
    secretSuffix: apiKey.slice(-4),
  });
  if (!result.ok) {
    console.warn('[atlas:model-connection] configure failed', {
      kind: result.kind,
      message: result.message,
      workspaceId: authorization.workspace.id,
    });
    await secretStore.delete(reference).catch(() => undefined);
    return Response.json({ message: result.message }, { status: 400 });
  }
  if (previous?.secretRef && previous.secretRef !== reference) {
    await secretStore.delete(atlasSecretReference(previous.secretRef)).catch(() => undefined);
  }
  revalidatePath(`/w/${encodeURIComponent(params.slug)}`);
  return Response.json(safeConnection(result.value as AtlasWorkspaceModelConnection));
};

export const DELETE = async (request: Request, { params }: RouteContext) => {
  const authorization = await authorizeOwner(request, params.slug);
  if (!authorization.ok) return authorization.response;
  const principal = authorization.access.principal!;
  const previous = await readConnection(principal, authorization.workspace.id);
  if (!previous) {
    return Response.json({ message: 'No Workspace model connection is configured.' }, { status: 404 });
  }
  const result = await invoke(principal, 'disableModelConnection', {
    workspace: atlasWorkspaceRef(authorization.workspace.id),
  });
  if (!result.ok) return Response.json({ message: result.message }, { status: 400 });

  const secretStore = createAtlasSecretStore();
  if (secretStore) {
    try {
      await secretStore.delete(atlasSecretReference(previous.secretRef));
    } catch {
      return Response.json(
        { ...safeConnection(result.value as AtlasWorkspaceModelConnection), cleanupPending: true },
        { status: 502 },
      );
    }
  }
  return Response.json(safeConnection(result.value as AtlasWorkspaceModelConnection));
};
