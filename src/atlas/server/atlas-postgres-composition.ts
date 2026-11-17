import fs from 'node:fs';
import path from 'node:path';

import type { Pool } from 'pg';

import type { AtlasReconciliationRequest } from '../domain/atlas-application';
import { createAtlasPostgresApplication } from '../persistence/postgres-application';
import { loadAtlasProjectionInput } from './load-atlas-projection';
import { createAtlasModelProvider } from './model-provider';
import { reconcileAtlasWorkspaceSources } from '../workspace/workspace-source-reconciliation';

export const getAtlasRepoRoot = () => {
  const cwd = process.cwd();

  if (
    fs.existsSync(path.join(cwd, 'package.json')) ||
    fs.existsSync(path.join(cwd, 'atlas.sources.local.yaml'))
  ) {
    return cwd;
  }

  return path.resolve(cwd, '..');
};

export const createAtlasPostgresComposition = (input: {
  invalidatePresentation?: () => void;
  invalidateRepository?: (repositoryFullName: string) => void;
  pool: Pick<Pool, 'connect' | 'query'>;
  repoRoot?: string;
}) => {
  const repoRoot = input.repoRoot ?? getAtlasRepoRoot();

  return createAtlasPostgresApplication({
    assistantProvider: createAtlasModelProvider(),
    pool: input.pool,
    reconcileWorkspaceSources: ({ sources }) =>
      reconcileAtlasWorkspaceSources({ repoRoot, sources }),
    loadProjection: async (request: AtlasReconciliationRequest, baseline) => {
      if (request.webhook) {
        input.invalidateRepository?.(request.webhook.repositoryFullName);
      }

      return loadAtlasProjectionInput({
        baseline,
        expectedBaseRevision:
          request.webhook && 'before' in request.webhook
            ? request.webhook.before
            : undefined,
        preferRemoteAtlas: process.env.NODE_ENV === 'production',
        providerDeliveryId: request.webhook?.deliveryId,
        repositoryFullName: request.webhook?.repositoryFullName,
        repoRoot,
      });
    },
    invalidatePresentation: input.invalidatePresentation,
  });
};
