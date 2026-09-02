import { configureServerRuntime } from '@ontahi/core/runtime/server';
import { Pool } from 'pg';

import { createAtlasPostgresComposition } from '../src/atlas/server/atlas-postgres-composition';

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
}

const trigger = process.argv[2] === 'rebuild' ? 'rebuild' : 'manual';
const pool = new Pool({ connectionString, max: 3 });
configureServerRuntime({ diagnostics: { exposeInternalErrorCauses: true } });

try {
  const atlas = createAtlasPostgresComposition({ pool });
  const result = await atlas.reconcile({ trigger });
  const snapshot = await atlas.getProjectionSnapshot();
  if (!snapshot) {
    throw new Error('Atlas reconciliation completed without a readable projection snapshot.');
  }
  process.stdout.write(
    `Atlas reconciliation ${result.projectionRevisionId}: ${result.sourceCount} sources, ${result.itemCount} items, ${result.planCount} plans, ${snapshot.edges.length} edges, ${snapshot.evidence?.length ?? 0} evidence bindings.\n`,
  );
} finally {
  await pool.end();
}
