import { spawn } from 'node:child_process';
import path from 'node:path';

import {
  createSerializedDebouncedTask,
  observeLocalAtlasSource,
} from '../src/atlas/sources/local-source-observer';
import { observeLocalSourceInventory } from '../src/atlas/sources/local-source-inventory';
import {
  materializeLocalWorkspace,
  type LocalWorkspaceMaterialization,
} from '../src/atlas/workspace/local-workspace-materialization';
import { runWorkspaceReconciliation } from './atlas-workspace-reconcile-command';

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
  let inventory: ReturnType<typeof observeLocalSourceInventory>['inventory'] | undefined;
  let materialized: LocalWorkspaceMaterialization | undefined;
  const pendingHints = new Set<string>();
  reconciliation = createSerializedDebouncedTask(
    async reasons => {
      const initialObservation = reasons.includes('initial observation');
      for (const reason of reasons) pendingHints.add(reason);
      const observation = observeLocalSourceInventory(repoRoot, inventory, {
        hints: [...pendingHints],
        full: initialObservation,
      });
      if (inventory && !initialObservation && observation.changes.length === 0) {
        inventory = observation.inventory;
        pendingHints.clear();
        return;
      }

      process.stdout.write(`[atlas:source] reconciling /${workspaceSlug} (${reasons.join(', ')})\n`);
      let candidate: LocalWorkspaceMaterialization | undefined;
      await runWorkspaceReconciliation(workspaceSlug, {
        localSourceFiles: Array.from(observation.inventory, ([filePath, file]) => ({
          path: filePath, content: file.content,
        })),
        parseSource: async input => {
          candidate = await materializeLocalWorkspace(input, materialized);
          return candidate.materialization.source;
        },
      });
      materialized = candidate;
      if (materialized) {
        const { parsedRecordCount, reusedRecordCount } = materialized.materialization;
        process.stdout.write(
          `[atlas:source] read ${observation.filesRead}, parsed ${parsedRecordCount}, reused ${reusedRecordCount}\n`,
        );
      }
      inventory = observation.inventory;
      pendingHints.clear();
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
