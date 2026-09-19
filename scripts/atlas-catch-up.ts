import { configureServerRuntime } from '@ontahi/core/runtime/server';
import { Pool } from 'pg';

import { createAtlasPostgresComposition } from '../src/atlas/server/atlas-postgres-composition';

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
}

const argumentsList = process.argv.slice(2);
const argumentsSet = new Set(argumentsList);
const sinceArguments = argumentsList.filter(argument => argument.startsWith('--since='));
const unknownArguments = argumentsList.filter(
  argument =>
    argument !== '--apply' &&
    argument !== '--dry-run' &&
    !argument.startsWith('--since='),
);

if (
  unknownArguments.length > 0 ||
  sinceArguments.length !== 1 ||
  (argumentsSet.has('--apply') && argumentsSet.has('--dry-run'))
) {
  throw new Error('Usage: atlas-catch-up.ts --since=<ISO-8601> [--dry-run|--apply]');
}

const apply = argumentsSet.has('--apply');
const sinceTimestamp = Date.parse(sinceArguments[0]!.slice('--since='.length));

if (!Number.isFinite(sinceTimestamp)) {
  throw new Error('Catch-up --since must be a valid ISO-8601 timestamp.');
}

const since = new Date(sinceTimestamp).toISOString();
const pool = new Pool({ connectionString, max: 3 });
configureServerRuntime({ diagnostics: { exposeInternalErrorCauses: true } });

const printPreview = (
  label: string,
  preview: Awaited<
    ReturnType<ReturnType<typeof createAtlasPostgresComposition>['previewMergeCatchUp']>
  >,
) => {
  process.stdout.write(
    `${label}: ${preview.observedPullRequests} observed, ${preview.eligiblePullRequests} on/after ${preview.since}, ${preview.excludedBeforeSince} before cutoff, ${preview.alreadyRecorded} already recorded in window, ${preview.candidates.length} candidates, ${preview.skipped.length} skipped, ${preview.sourceFailures.length} source failures.\n`,
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
  const before = await atlas.previewMergeCatchUp({ since });

  printPreview('Atlas merge catch-up preview', before);

  if (!apply) {
    process.stdout.write('Dry-run only. Re-run with --apply to commit the catch-up.\n');
  } else {
    if (before.sourceFailures.length > 0) {
      throw new Error('Catch-up apply aborted because one or more source observations failed.');
    }

    const result = await atlas.reconcile({ catchUpSince: since, trigger: 'catch-up' });
    const after = await atlas.previewMergeCatchUp({ since });
    const recovered = Math.max(0, before.candidates.length - after.candidates.length);

    process.stdout.write(
      `Applied catch-up ${result.projectionRevisionId}: ${recovered} activities recovered, ${after.candidates.length} candidates remain.\n`,
    );
    printPreview('Atlas merge catch-up after apply', after);
  }
} finally {
  await pool.end();
}
