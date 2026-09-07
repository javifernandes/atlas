import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
}

const pool = new Pool({ connectionString, max: 1 });

const asNumber = (value: string | number | null | undefined) => Number(value ?? 0);

try {
  const [latestRevision, sourceRecords, inventories, counts] = await Promise.all([
    pool.query<{
      full_row_bytes: string;
      id_bytes: string;
      snapshot_bytes: string;
    }>(`
      SELECT
        octet_length(id)::bigint AS id_bytes,
        octet_length(snapshot_json)::bigint AS snapshot_bytes,
        (
          octet_length(id) + octet_length(trigger) + octet_length(source_revision_set_hash) +
          octet_length(snapshot_json) + octet_length(diagnostics_json) +
          octet_length(started_at::text) + octet_length(completed_at::text) +
          octet_length(status)
        )::bigint AS full_row_bytes
      FROM projection_revisions
      ORDER BY started_at DESC
      LIMIT 1
    `),
    pool.query<{ content_bytes: string; full_row_bytes: string; row_count: number }>(`
      SELECT
        count(*)::int AS row_count,
        COALESCE(sum(octet_length(content)), 0)::bigint AS content_bytes,
        COALESCE(sum(
          octet_length(id) + octet_length(canonical_path) + octet_length(source_id) +
          octet_length(source_revision_id) + octet_length(source_path) +
          COALESCE(octet_length(source_file_path), 0) + octet_length(record_kind) +
          octet_length(content) + octet_length(content_hash)
        ), 0)::bigint AS full_row_bytes
      FROM atlas_source_records
    `),
    pool.query<{
      item_bytes: string;
      plan_bytes: string;
    }>(`
      SELECT
        (SELECT COALESCE(sum(octet_length(to_jsonb(item)::text)), 0)::bigint FROM atlas_items item)
          AS item_bytes,
        (SELECT COALESCE(sum(octet_length(to_jsonb(plan)::text)), 0)::bigint FROM atlas_plans plan)
          AS plan_bytes
    `),
    pool.query<Record<string, number>>(`
      SELECT
        (SELECT count(*)::int FROM atlas_source_records) AS atlas_source_records,
        (SELECT count(*)::int FROM atlas_items) AS atlas_items,
        (SELECT count(*)::int FROM atlas_plans) AS atlas_plans,
        (SELECT count(*)::int FROM projection_revisions) AS projection_revisions,
        (SELECT count(*)::int FROM webhook_deliveries) AS webhook_deliveries,
        (SELECT count(*)::int FROM pull_requests) AS pull_requests,
        (SELECT count(*)::int FROM evidence_bindings) AS evidence_bindings
    `),
  ]);

  const revision = latestRevision.rows[0];
  const sources = sourceRecords.rows[0]!;
  const inventory = inventories.rows[0]!;
  const latestRevisionIdBytes = asNumber(revision?.id_bytes);
  const latestSnapshotBytes = asNumber(revision?.snapshot_bytes);
  const latestRevisionFullRowBytes = asNumber(revision?.full_row_bytes);
  const sourceRecordFullRowBytes = asNumber(sources.full_row_bytes);
  const itemFullRowBytes = asNumber(inventory.item_bytes);
  const planFullRowBytes = asNumber(inventory.plan_bytes);

  process.stdout.write(
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        latestProjectionRevision: {
          fullRowBytes: latestRevisionFullRowBytes,
          idBytes: latestRevisionIdBytes,
          snapshotBytes: latestSnapshotBytes,
        },
        sourceRecords: {
          contentBytes: asNumber(sources.content_bytes),
          fullRowBytes: sourceRecordFullRowBytes,
          rows: sources.row_count,
        },
        tableRows: counts.rows[0],
        transferEstimate: {
          currentPageCacheHitBytes: latestRevisionIdBytes,
          currentPageCacheMissBytes:
            latestRevisionIdBytes + latestRevisionFullRowBytes,
          currentReconciliationReadFloorBytes: latestRevisionFullRowBytes,
          previousReconciliationBroadInventoryBytes:
            latestRevisionFullRowBytes +
            sourceRecordFullRowBytes +
            itemFullRowBytes +
            planFullRowBytes,
        },
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await pool.end();
}
