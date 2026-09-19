import { configureServerRuntime } from '@ontahi/core/runtime/server';
import { Pool } from 'pg';

import { createAtlasPostgresComposition } from '../src/atlas/server/atlas-postgres-composition';

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
}

const argumentsSet = new Set(process.argv.slice(2));
const unknownArguments = [...argumentsSet].filter(
  argument => argument !== '--apply' && argument !== '--dry-run',
);

if (unknownArguments.length > 0 || (argumentsSet.has('--apply') && argumentsSet.has('--dry-run'))) {
  throw new Error('Usage: atlas-catch-up.ts [--dry-run|--apply]');
}

const apply = argumentsSet.has('--apply');
const pool = new Pool({ connectionString, max: 3 });
configureServerRuntime({ diagnostics: { exposeInternalErrorCauses: true } });

const printPreview = (
  label: string,
  preview: Awaited<
    ReturnType<ReturnType<typeof createAtlasPostgresComposition>['previewMergeCatchUp']>
  >,
) => {
  process.stdout.write(
    `${label}: ${preview.observedPullRequests} observed, ${preview.alreadyRecorded} already recorded, ${preview.candidates.length} candidates, ${preview.skipped.length} skipped, ${preview.sourceFailures.length} source failures.\n`,
  );

  for (const failure of preview.sourceFailures) {
    process.stdout.write(
      `  SOURCE_FAILURE ${failure.sourceId} ${failure.repositoryFullName} ${failure.message}\n`,
    );
  }

  for (const candidate of preview.candidates) {
    process.stdout.write(
      `  CANDIDATE ${candidate.id} ${candidate.mergedAt} ${candidate.action} ${candidate.planId} ${candidate.title}\n`,
    );
  }

  for (const skipped of preview.skipped) {
    process.stdout.write(
      `  SKIPPED ${skipped.id} ${skipped.reason} ${skipped.title}\n`,
    );
  }
};

try {
  const atlas = createAtlasPostgresComposition({ pool });
  const before = await atlas.previewMergeCatchUp();

  printPreview('Atlas merge catch-up preview', before);

  if (!apply) {
    process.stdout.write('Dry-run only. Re-run with --apply to commit the catch-up.\n');
  } else {
    if (before.sourceFailures.length > 0) {
      throw new Error('Catch-up apply aborted because one or more source observations failed.');
    }

    const result = await atlas.reconcile({ trigger: 'catch-up' });
    const after = await atlas.previewMergeCatchUp();
    const recovered = Math.max(0, before.candidates.length - after.candidates.length);

    process.stdout.write(
      `Applied catch-up ${result.projectionRevisionId}: ${recovered} activities recovered, ${after.candidates.length} candidates remain.\n`,
    );
    printPreview('Atlas merge catch-up after apply', after);
  }
} finally {
  await pool.end();
}
