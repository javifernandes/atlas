import { withInvocationContext } from '@ontahi/core/runtime/server';
import { Pool } from 'pg';

import {
  createAtlasPostgresComposition,
  getAtlasRepoRoot,
} from '../src/atlas/server/atlas-postgres-composition';
import {
  ATLAS_WORKSPACE_SOURCE_RECONCILIATION_RESOURCE,
  reconcileAtlasWorkspaceSources,
} from '../src/atlas/workspace/workspace-source-reconciliation';

const workspaceSlug = process.argv[2]?.trim();
if (!workspaceSlug) {
  throw new Error('Usage: pnpm db:reconcile:workspace <workspace-slug>');
}

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');

const pool = new Pool({ connectionString, max: 3 });

try {
  const workspaceResult = await pool.query<{ id: string; owner_user_id: string }>(
    `SELECT workspace.id, membership.user_id AS owner_user_id
       FROM atlas_workspaces AS workspace
       JOIN atlas_workspace_memberships AS membership
         ON membership.workspace_id = workspace.id
        AND membership.role = 'owner'
        AND membership.status = 'active'
      WHERE workspace.slug = $1
      ORDER BY membership.created_at ASC
      LIMIT 1`,
    [workspaceSlug],
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    throw new Error(`Workspace /${workspaceSlug} does not exist or has no active owner.`);
  }

  const repoRoot = getAtlasRepoRoot();
  const atlas = createAtlasPostgresComposition({ pool, repoRoot });
  const operation = atlas.application.graph.entities.AtlasWorkspace.domain.reconcileSources;
  const invocation = await withInvocationContext(
    {
      principal: { issuer: 'atlas-cli', kind: 'user', subject: workspace.owner_user_id },
      resources: new Map([
        [
          ATLAS_WORKSPACE_SOURCE_RECONCILIATION_RESOURCE,
          {
            reconcile: ({ sources }: { sources: Array<{ id: string; ref: string; repository: string }> }) =>
              reconcileAtlasWorkspaceSources({ repoRoot, sources }),
          },
        ],
      ]),
    } as never,
    () =>
      atlas.application.invokeOperation(operation, {
        workspace: { id: workspace.id },
        triggerSourceId: null,
        trigger: 'manual',
      }),
  );

  if (!invocation.ok) {
    throw new Error(`Workspace reconciliation was rejected: ${JSON.stringify(invocation)}`);
  }

  const task = invocation.value as { runId: string; taskId: string };
  process.stdout.write(`Workspace /${workspaceSlug}: reconciliation ${task.runId} queued.\n`);

  for (;;) {
    const run = await atlas.getWorkspaceSourceTaskRun(task);
    if (!run) throw new Error(`Task Run ${task.runId} disappeared.`);

    if (run.status === 'completed') {
      const result = run.result as { projectionRevisionId?: string | null } | null;
      process.stdout.write(
        `Workspace /${workspaceSlug}: completed${result?.projectionRevisionId ? ` (${result.projectionRevisionId})` : ''}.\n`,
      );
      break;
    }

    if (run.status === 'failed' || run.status === 'cancelled') {
      throw new Error(`Workspace reconciliation ${run.status}: ${JSON.stringify(run.result)}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
} finally {
  await pool.end();
}
