import { Pool } from 'pg';

type AtlasPostgresPoolState = {
  connectionString: string;
  pool: Pool;
};

const globalPoolState = globalThis as typeof globalThis & {
  __atlasPostgresPoolState?: AtlasPostgresPoolState;
};

export const getAtlasPostgresPool = (connectionString: string) => {
  const existing = globalPoolState.__atlasPostgresPoolState;

  if (existing) {
    if (existing.connectionString !== connectionString) {
      throw new Error('Atlas PostgreSQL was already initialized with another DATABASE_URL.');
    }

    return existing.pool;
  }

  const pool = new Pool({ connectionString, max: 10 });
  globalPoolState.__atlasPostgresPoolState = { connectionString, pool };
  return pool;
};
