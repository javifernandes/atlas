import {
  inferPostgresMappings,
  inspectPostgresDataGraphSchema,
} from '@ontahi/postgres/data-graph';
import { getMigrations } from 'better-auth/db/migration';
import { Pool } from 'pg';

import { atlasEntities } from '../src/atlas/domain/atlas-application';
import { runAtlasMigrations } from '../src/atlas/persistence/migrations';
import { atlasPostgresMappingOverrides } from '../src/atlas/persistence/postgres-mapping';
import { createAtlasAuthPersistenceOptions } from '../src/auth/persistence';

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
}

const pool = new Pool({ connectionString, max: 2 });
const command = process.argv[2];

try {
  if (command === 'migrate') {
    const result = await runAtlasMigrations({ pool });
    process.stdout.write(
      `Atlas migrations: ${result.applied.length} applied, ${result.skipped.length} unchanged.\n`,
    );
  } else if (command === 'verify') {
    inferPostgresMappings(atlasEntities, { overrides: atlasPostgresMappingOverrides });
    const inspection = await inspectPostgresDataGraphSchema({
      entities: atlasEntities,
      pool,
    });

    if (!inspection.ok) {
      throw new Error(`Atlas PostgreSQL schema mismatch: ${JSON.stringify(inspection.issues)}`);
    }

    const authMigrations = await getMigrations(
      createAtlasAuthPersistenceOptions(pool),
      { throwOnUnsafe: false },
    );
    const authMismatch = {
      addedFields: authMigrations.toBeAdded,
      addedIndexes: authMigrations.toBeAddedIndexes,
      createdTables: authMigrations.toBeCreated,
      unsafeChanges: authMigrations.unsafeChanges,
    };

    if (Object.values(authMismatch).some(changes => changes.length > 0)) {
      throw new Error(`Atlas Better Auth schema mismatch: ${JSON.stringify(authMismatch)}`);
    }

    process.stdout.write(
      'Atlas PostgreSQL schema matches the Ontahi entity and Better Auth models.\n',
    );
  } else {
    throw new Error('Usage: atlas-postgres.ts <migrate|verify>');
  }
} finally {
  await pool.end();
}
