import { spawn } from 'node:child_process';
import path from 'node:path';

import {
  createSerializedDebouncedTask,
  observeLocalAtlasSource,
} from '../src/atlas/sources/local-source-observer';
import { readLocalAtlasSourceRevision } from '../src/atlas/sources/markdown-source';

const repoRoot = process.cwd();
const workspaceSlug = process.env.ATLAS_DEV_WORKSPACE_SLUG?.trim() || 'atlas';
const sourceWatchEnabled = process.env.ATLAS_DEV_SOURCE_WATCH !== '0';
const hasDatabase = Boolean(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);

const nextProcess = spawn(
  process.execPath,
  [path.join(repoRoot, 'node_modules/next/dist/bin/next'), 'dev', ...process.argv.slice(2)],
  { cwd: repoRoot, env: process.env, stdio: 'inherit' },
);

let watcher: ReturnType<typeof observeLocalAtlasSource> | undefined;
let reconciliation: ReturnType<typeof createSerializedDebouncedTask> | undefined;

if (sourceWatchEnabled && hasDatabase) {
  let observedSourceRevision = readLocalAtlasSourceRevision(repoRoot);
  reconciliation = createSerializedDebouncedTask(
    async reasons => {
      const nextSourceRevision = readLocalAtlasSourceRevision(repoRoot);
      const initialObservation = reasons.includes('initial observation');
      if (!initialObservation && nextSourceRevision === observedSourceRevision) return;

      process.stdout.write(`[atlas:source] reconciling /${workspaceSlug} (${reasons.join(', ')})\n`);
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          path.join(repoRoot, 'scripts/atlas-workspace-reconcile.ts'),
          workspaceSlug,
        ],
        { cwd: repoRoot, env: process.env, stdio: 'inherit' },
      );

      const exitCode = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', resolve);
      });
      if (exitCode !== 0) throw new Error(`Workspace reconciliation exited with code ${exitCode}.`);
      observedSourceRevision = nextSourceRevision;
    },
    {
      delayMs: 400,
      onError: error => {
        process.stderr.write(
          `[atlas:source] reconciliation failed; dev server remains available: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      },
    },
  );

  watcher = observeLocalAtlasSource({
    repoRoot,
    onChange: change => reconciliation?.schedule(change.relativePath),
    onError: error => process.stderr.write(`[atlas:source] watcher failed: ${error.message}\n`),
  });
  process.stdout.write(`[atlas:source] watching local semantic Source for /${workspaceSlug}\n`);
  reconciliation.schedule('initial observation');
} else if (sourceWatchEnabled) {
  process.stdout.write('[atlas:source] local observation disabled because no DATABASE_URL is configured\n');
}

const close = () => {
  watcher?.close();
  reconciliation?.close();
};

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    close();
    nextProcess.kill(signal);
  });
}

nextProcess.once('error', error => {
  close();
  process.stderr.write(`[atlas:dev] failed to start Next.js: ${error.message}\n`);
  process.exitCode = 1;
});

nextProcess.once('exit', (code, signal) => {
  close();
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
