import { Pool } from 'pg';

import { getAtlasRepoRoot } from '../src/atlas/server/atlas-postgres-composition';
import {
  backfillAtlasWorkspaceSourceInstallations,
  backfillCanonicalAtlasWorkspaceOwner,
  backfillCanonicalAtlasWorkspaceProjection,
} from '../src/atlas/workspace/backfill-source-installations';
import { reconcileAtlasWorkspaceSources } from '../src/atlas/workspace/workspace-source-reconciliation';

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');

const pool = new Pool({ connectionString, max: 2 });
try {
  const owner = await backfillCanonicalAtlasWorkspaceOwner({ pool });
  process.stdout.write(
    owner.ownerAssigned
      ? 'Canonical Workspace owner reconciled.\n'
      : 'Canonical Workspace has no Atlas User to assign yet.\n',
  );
  const result = await backfillAtlasWorkspaceSourceInstallations({ pool });
  process.stdout.write(
    `Workspace Source installation backfill: ${result.updated} updated, ${result.inspected} inspected.\n`,
  );
  const projection = await backfillCanonicalAtlasWorkspaceProjection({
    pool,
    reconcile: ({ sources }) =>
      reconcileAtlasWorkspaceSources({ repoRoot: getAtlasRepoRoot(), sources }),
  });
  process.stdout.write(
    projection.created
      ? `Canonical Workspace projection created from ${projection.sourceCount} Sources.\n`
      : 'Canonical Workspace projection already exists.\n',
  );
} finally {
  await pool.end();
}
