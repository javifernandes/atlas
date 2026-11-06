import { revalidatePath, revalidateTag } from 'next/cache';
import { getAtlasPostgresPool } from '../../database/postgres-pool';
import { createAtlasOntahiApplication } from '../domain/atlas-application';
import { githubRepositoryCacheTag } from '../github/repository';
import { createAtlasPostgresComposition, getAtlasRepoRoot } from './atlas-postgres-composition';
import { loadAtlasProjectionInput } from './load-atlas-projection';
import { createAtlasModelProvider } from './model-provider';
import {
  registerLocalWorkspace,
  unregisterLocalWorkspace,
} from '../workspace/local-workspace-registry';
import { listAtlasWorkspacesForUser } from '../workspace/workspace-access';
import { Effect } from 'effect';

type AtlasServerApplication =
  | ReturnType<typeof createAtlasOntahiApplication>
  | ReturnType<typeof createAtlasPostgresComposition>;

type AtlasCompositionState = {
  application?: Promise<AtlasServerApplication>;
};

const compositionState = globalThis as typeof globalThis & {
  __atlasCompositionState?: AtlasCompositionState;
};

const state = (compositionState.__atlasCompositionState ??= {});

export const resolveAtlasStorageMode = (
  environment: Record<string, string | undefined> = process.env,
) => {
  const configured = environment.ATLAS_STORAGE_MODE;

  if (configured && configured !== 'memory' && configured !== 'postgres') {
    throw new Error('ATLAS_STORAGE_MODE must be either "postgres" or "memory".');
  }

  return configured ?? (environment.DATABASE_URL ? 'postgres' : 'memory');
};

const invalidateRepository = (repositoryFullName: string) => {
  revalidateTag(githubRepositoryCacheTag(repositoryFullName));
};

const invalidatePresentation = () => {
  revalidatePath('/');
};

const createMemoryComposition = async () => {
  const projection = await loadAtlasProjectionInput({ repoRoot: getAtlasRepoRoot() });

  return createAtlasOntahiApplication(projection.records, {
    assistantProvider: createAtlasModelProvider(),
    loadedSourceRevisions: projection.sourceRevisions,
    observedPullRequests: projection.observedPullRequests,
    workspaceCreated: ({ userId, workspace }) =>
      Effect.sync(() => registerLocalWorkspace(userId, { ...workspace, role: 'owner' })),
    workspaceDeleted: ({ userId, workspaceId }) =>
      Effect.sync(() => unregisterLocalWorkspace(userId, workspaceId)),
    workspaceRoleFor: (userId, workspaceId) =>
      Effect.promise(async () =>
        (await listAtlasWorkspacesForUser(userId)).find(workspace => workspace.id === workspaceId)
          ?.role ?? null,
      ),
    invalidateRepository,
    invalidatePresentation: () => {
      state.application = undefined;
      invalidatePresentation();
    },
  });
};

const createPostgresComposition = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required when Atlas uses the PostgreSQL storage mode.',
    );
  }

  return createAtlasPostgresComposition({
    pool: getAtlasPostgresPool(connectionString),
    invalidateRepository,
    invalidatePresentation,
  });
};

const createComposition = async (): Promise<AtlasServerApplication> =>
  resolveAtlasStorageMode() === 'postgres'
    ? createPostgresComposition()
    : createMemoryComposition();

export const getAtlasServerApplication = () => {
  state.application ??= createComposition().catch(error => {
      state.application = undefined;
      throw error;
    });

  return state.application;
};

export const prewarmAtlasServerApplication = () => {
  if (resolveAtlasStorageMode() !== 'memory') return;
  void getAtlasServerApplication().catch(error => {
    console.error('Atlas local runtime prewarm failed.', error);
  });
};
