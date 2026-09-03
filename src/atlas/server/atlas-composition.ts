import { revalidatePath, revalidateTag } from 'next/cache';
import { getAtlasPostgresPool } from '../../database/postgres-pool';
import { createAtlasOntahiApplication } from '../domain/atlas-application';
import { githubRepositoryCacheTag } from '../github/repository';
import { createAtlasPostgresComposition, getAtlasRepoRoot } from './atlas-postgres-composition';
import { loadAtlasProjectionInput } from './load-atlas-projection';

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

const resolveStorageMode = () => {
  const configured = process.env.ATLAS_STORAGE_MODE;

  if (configured && configured !== 'memory' && configured !== 'postgres') {
    throw new Error('ATLAS_STORAGE_MODE must be either "postgres" or "memory".');
  }

  return configured ?? (process.env.NODE_ENV === 'production' ? 'postgres' : 'memory');
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
    observedPullRequests: projection.observedPullRequests,
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
  resolveStorageMode() === 'postgres'
    ? createPostgresComposition()
    : createMemoryComposition();

export const getAtlasServerApplication = () => {
  state.application ??= createComposition().catch(error => {
      state.application = undefined;
      throw error;
    });

  return state.application;
};
