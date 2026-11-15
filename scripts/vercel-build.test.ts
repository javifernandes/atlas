import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })),
  );
});

const runBuildScript = async (input: { failCommand?: string; vercelEnvironment?: string } = {}) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'atlas-vercel-build-'));
  temporaryDirectories.push(directory);
  const commandLog = path.join(directory, 'commands.log');
  const fakePnpm = path.join(directory, 'pnpm');
  await writeFile(
    fakePnpm,
    '#!/usr/bin/env bash\nprintf \'%s\\n\' "$*" >> "$ATLAS_TEST_COMMAND_LOG"\n[[ "$*" != "${ATLAS_TEST_FAIL_COMMAND:-}" ]]\n',
  );
  await chmod(fakePnpm, 0o755);

  const result = spawnSync('bash', ['scripts/vercel-build.sh'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      ATLAS_TEST_COMMAND_LOG: commandLog,
      ATLAS_TEST_FAIL_COMMAND: input.failCommand ?? '',
      DATABASE_URL_UNPOOLED: 'postgresql://atlas:secret@production.example/atlas',
      PATH: `${directory}:${process.env.PATH ?? ''}`,
      VERCEL_ENV: input.vercelEnvironment ?? '',
    },
  });

  return {
    commands: (await readFile(commandLog, 'utf8')).trim().split('\n'),
    status: result.status,
  };
};

describe('Vercel build', () => {
  it('reconciles the projection after a successful production build', async () => {
    await expect(runBuildScript({ vercelEnvironment: 'production' })).resolves.toEqual({
      commands: ['db:migrate', 'db:backfill:workspaces', 'db:verify', 'build', 'db:reconcile'],
      status: 0,
    });
  });

  it('does not access persistent production operations outside production', async () => {
    await expect(runBuildScript({ vercelEnvironment: 'preview' })).resolves.toEqual({
      commands: ['build'],
      status: 0,
    });
  });

  it('does not reconcile when the application build fails', async () => {
    await expect(
      runBuildScript({ failCommand: 'build', vercelEnvironment: 'production' }),
    ).resolves.toEqual({
      commands: ['db:migrate', 'db:backfill:workspaces', 'db:verify', 'build'],
      status: 1,
    });
  });
});
