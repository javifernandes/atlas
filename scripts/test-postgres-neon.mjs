import { execFileSync, spawnSync } from 'node:child_process';

const projectId = process.env.NEON_PROJECT_ID ?? 'weathered-rain-59323266';
const parentBranch = process.env.NEON_PARENT_BRANCH ?? 'production';
const branchName = `test/atlas-${Date.now()}`;
const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
let branchId;
let testStatus = 1;

try {
  const created = JSON.parse(
    execFileSync(
      'neon',
      [
        'branches',
        'create',
        '--project-id',
        projectId,
        '--parent',
        parentBranch,
        '--name',
        branchName,
        '--expires-at',
        expiresAt,
        '--no-secrets',
        '--output',
        'json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    ),
  );

  branchId = created.branch?.id;
  if (
    typeof branchId !== 'string' ||
    created.branch?.project_id !== projectId ||
    created.branch?.name !== branchName
  ) {
    throw new Error('Neon created an unexpected test branch.');
  }

  console.log(
    `Created ephemeral Neon branch ${branchName} (${branchId}) from ${parentBranch}.`,
  );
  const connectionString = execFileSync(
    'neon',
    [
      'connection-string',
      branchId,
      '--project-id',
      projectId,
      '--ssl',
      'verify-full',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  ).trim();

  if (!connectionString.startsWith('postgresql://')) {
    throw new Error('Neon returned an unexpected connection-string format.');
  }

  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      'src/atlas/persistence/postgres-application.integration.test.ts',
    ],
    {
      env: {
        ...process.env,
        ATLAS_POSTGRES_TEST_ENABLED: '1',
        ATLAS_POSTGRES_TEST_URL: connectionString,
      },
      stdio: 'inherit',
    },
  );

  testStatus = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Neon test setup failed.');
} finally {
  if (branchId) {
    const cleanup = spawnSync(
      'neon',
      ['branches', 'delete', branchId, '--project-id', projectId],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    );

    if (cleanup.status === 0) {
      console.log(`Deleted ephemeral Neon branch ${branchName} (${branchId}).`);
    } else {
      console.error(
        `Could not delete ephemeral Neon branch ${branchName} (${branchId}); it expires at ${expiresAt}.`,
      );
      testStatus = 1;
    }
  }
}

process.exitCode = testStatus;
