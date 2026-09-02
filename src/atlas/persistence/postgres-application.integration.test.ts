// @vitest-environment node

import { randomUUID } from 'node:crypto';

import { inferPostgresMappings, inspectPostgresDataGraphSchema } from '@ontahi/postgres/data-graph';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  atlasEntities,
  type AtlasMergedPullRequestInput,
  type AtlasRepositoryPushInput,
} from '../domain/atlas-application';
import type { AtlasObservedPullRequest } from '../github/pull-request-evidence';
import { normalizeAtlasSourceRecord } from '../sources/normalized-source';
import { runAtlasMigrations } from './migrations';
import { createAtlasPostgresApplication } from './postgres-application';

const externalConnectionString =
  process.env.ATLAS_POSTGRES_TEST_URL ??
  (process.env.ATLAS_POSTGRES_TEST_TARGET === 'neon'
    ? process.env.DATABASE_URL_UNPOOLED
    : undefined);
const describePostgres = process.env.ATLAS_POSTGRES_TEST_ENABLED === '1' ? describe : describe.skip;

describePostgres('Atlas PostgreSQL persistence', () => {
  const schema = `atlas_test_${randomUUID().replaceAll('-', '')}`;
  const sourceFiles = [
    {
      path: 'plans/current/116-persistence.md',
      source: 'atlas',
      content: '# 116. Persistence\n\nStatus: current\n',
    },
    {
      path: 'atlas/items/persistence.md',
      source: 'atlas',
      content: `---
id: atlas.persistence
kind: capability
title: Atlas Persistence
status: shaping
horizon: now
relatedPlans:
  - plans/current/116-persistence.md
---

Durable Atlas projection.
`,
    },
  ];
  const records = sourceFiles.map(normalizeAtlasSourceRecord);
  const sourceRevisions = [
    {
      id: 'atlas:markdown:test-revision',
      sourceId: 'atlas',
      repository: 'javifernandes/atlas',
      authority: 'markdown' as const,
      revision: 'test-revision',
      revisionKind: 'git' as const,
      observedAt: '2026-09-02T00:00:00.000Z',
    },
  ];
  const observedPullRequest: AtlasObservedPullRequest = {
    authorAvatarUrl: null,
    authorLogin: 'javi',
    directives: [{ kind: 'implements', target: 'atlas://plans/116-persistence' }],
    id: 'github:javifernandes/atlas#14',
    mergeCommitSha: 'merge-14',
    mergedByAvatarUrl: null,
    mergedByLogin: 'javi',
    mergedAt: '2026-09-02T01:00:00.000Z',
    number: 14,
    repositoryFullName: 'javifernandes/atlas',
    sourceId: 'atlas',
    title: 'Persist Atlas',
    url: 'https://github.com/javifernandes/atlas/pull/14',
  };
  let observedAtSequence = 0;
  let evidenceAvailable = true;
  let container: StartedPostgreSqlContainer | undefined;
  let adminPool!: Pool;
  let pool!: Pool;
  let atlas!: ReturnType<typeof createAtlasPostgresApplication>;
  const startPostgres = async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();
    return container;
  };

  beforeAll(async () => {
    const connectionString = externalConnectionString ?? (await startPostgres()).getConnectionUri();

    adminPool = new Pool({ connectionString, max: 1 });
    pool = new Pool({
      connectionString,
      max: 3,
      options: `-c search_path=${schema}`,
    });
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    atlas = createAtlasPostgresApplication({
      pool,
      loadProjection: async () => ({
        evidenceFailures: evidenceAvailable
          ? []
          : [
              {
                repositoryFullName: 'javifernandes/atlas',
                sourceId: 'atlas',
                message: 'temporary GitHub failure',
              },
            ],
        evidenceSourceIds: evidenceAvailable ? ['atlas'] : [],
        observedAt: `2026-09-02T00:00:0${observedAtSequence++}.000Z`,
        observedPullRequests: evidenceAvailable ? [observedPullRequest] : [],
        records,
        sourceRevisions,
      }),
    });
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
      await adminPool.end();
    }
    await container?.stop();
  }, 180_000);

  it('migrates an empty schema repeatedly and matches the Ontahi model', async () => {
    await expect(runAtlasMigrations({ pool })).resolves.toMatchObject({
      applied: [
        '001-atlas-postgres-projection.sql',
        '002-projection-reconciliation-diagnostics.sql',
        '003-source-record-physical-identity.sql',
        '004-projection-reconciliation-lock.sql',
        '005-projection-revision-observation-order.sql',
      ],
      skipped: [],
    });
    await expect(runAtlasMigrations({ pool })).resolves.toMatchObject({
      applied: [],
      skipped: expect.arrayContaining(['001-atlas-postgres-projection.sql']),
    });

    inferPostgresMappings(atlasEntities);
    await expect(
      inspectPostgresDataGraphSchema({ entities: atlasEntities, pool, schema }),
    ).resolves.toMatchObject({ ok: true, issues: [] });
  }, 30_000);

  it('reconciles repeatedly without duplicating the current graph', async () => {
    await expect(atlas.reconcile({ trigger: 'bootstrap' })).resolves.toMatchObject({
      duplicate: false,
      itemCount: 1,
      planCount: 1,
      evidenceBindingCount: 1,
    });
    await expect(atlas.reconcile({ trigger: 'rebuild' })).resolves.toMatchObject({
      duplicate: false,
      itemCount: 1,
      planCount: 1,
      evidenceBindingCount: 1,
    });

    const counts = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM atlas_items) AS items,
        (SELECT count(*)::int FROM atlas_plans) AS plans,
        (SELECT count(*)::int FROM pull_requests) AS pull_requests,
        (SELECT count(*)::int FROM evidence_bindings) AS evidence_bindings
    `);
    expect(counts.rows[0]).toEqual({
      items: 1,
      plans: 1,
      pull_requests: 1,
      evidence_bindings: 1,
    });
    await expect(atlas.getProjectionSnapshot()).resolves.toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: 'atlas:atlas.persistence' }),
        expect.objectContaining({ id: 'plan:atlas://plans/116-persistence' }),
      ]),
      edges: expect.arrayContaining([expect.objectContaining({ kind: 'shaped-by' })]),
      evidence: [expect.objectContaining({ id: expect.stringContaining('github:') })],
    });
    await expect(atlas.getEvidence()).resolves.toHaveLength(1);
    await expect(atlas.getTopologyEdges()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'shaped-by' })]),
    );

    evidenceAvailable = false;
    await expect(atlas.reconcile({ trigger: 'manual' })).resolves.toMatchObject({
      evidenceBindingCount: 1,
    });
    await expect(atlas.getEvidence()).resolves.toHaveLength(1);
    await expect(atlas.getProjectionSnapshot()).resolves.toMatchObject({
      evidence: [expect.objectContaining({ id: expect.stringContaining('github:') })],
    });
    await expect(
      pool.query('SELECT status FROM projection_revisions ORDER BY completed_at DESC LIMIT 1'),
    ).resolves.toMatchObject({ rows: [{ status: 'degraded' }] });
    evidenceAvailable = true;
  }, 30_000);

  it('deduplicates a GitHub delivery durably', async () => {
    const webhook: AtlasMergedPullRequestInput = {
      authorLogin: 'javi',
      body: 'Atlas-Implements: atlas://plans/116-persistence',
      deliveryId: 'delivery-116',
      installationId: '1234',
      mergeCommitSha: 'merge-14',
      mergedAt: '2026-09-02T01:00:00.000Z',
      number: 14,
      repositoryFullName: 'javifernandes/atlas',
      title: 'Persist Atlas',
      url: 'https://github.com/javifernandes/atlas/pull/14',
    };
    const invoke = () =>
      atlas.application.invokeOperation(
        atlas.application.graph.entities.PullRequest.domain.refreshAfterMerge,
        webhook,
      );

    await expect(invoke()).resolves.toMatchObject({
      ok: true,
      value: { duplicate: false },
    });
    await expect(invoke()).resolves.toMatchObject({
      ok: true,
      value: { duplicate: true },
    });
    const push: AtlasRepositoryPushInput = {
      after: 'push-revision',
      before: 'previous-revision',
      deliveryId: 'delivery-push-116',
      installationId: '1234',
      ref: 'refs/heads/main',
      repositoryFullName: 'javifernandes/atlas',
    };
    const invokePush = () =>
      atlas.application.invokeOperation(
        atlas.application.graph.entities.ProjectionRevision.domain.refreshAfterPush,
        push,
      );

    await expect(invokePush()).resolves.toMatchObject({
      ok: true,
      value: { duplicate: false },
    });
    await expect(invokePush()).resolves.toMatchObject({
      ok: true,
      value: { duplicate: true },
    });
    const counts = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM webhook_deliveries) AS deliveries,
        (SELECT count(*)::int FROM projection_revisions) AS projection_revisions
    `);
    expect(counts.rows[0]).toEqual({ deliveries: 2, projection_revisions: 5 });
  }, 30_000);

  it('does not let an older observation overwrite a newer projection', async () => {
    let loadCount = 0;
    let announceOlderLoad!: () => void;
    let releaseOlderLoad!: () => void;
    const olderLoadStarted = new Promise<void>(resolve => {
      announceOlderLoad = resolve;
    });
    const olderLoadGate = new Promise<void>(resolve => {
      releaseOlderLoad = resolve;
    });
    const projection = (title: string, revision: string, observedAt: string) => ({
      evidenceFailures: [],
      evidenceSourceIds: ['atlas'],
      observedAt,
      observedPullRequests: [observedPullRequest],
      records: sourceFiles
        .map(file =>
          file.path === 'atlas/items/persistence.md'
            ? {
                ...file,
                content: file.content.replace('Atlas Persistence', title),
              }
            : file,
        )
        .map(normalizeAtlasSourceRecord),
      sourceRevisions: [
        {
          ...sourceRevisions[0]!,
          id: `atlas:markdown:${revision}`,
          revision,
          observedAt,
        },
      ],
    });
    const racingAtlas = createAtlasPostgresApplication({
      pool,
      loadProjection: async () => {
        loadCount += 1;
        if (loadCount === 1) {
          announceOlderLoad();
          await olderLoadGate;
          return projection(
            'Older Atlas Persistence',
            'older-revision',
            '2026-09-02T03:00:00.000Z',
          );
        }

        return projection('Newer Atlas Persistence', 'newer-revision', '2026-09-02T04:00:00.000Z');
      },
    });
    const before = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM projection_revisions',
    );
    const older = racingAtlas.reconcile({ trigger: 'manual' });
    await olderLoadStarted;
    await racingAtlas.reconcile({ trigger: 'manual' });
    releaseOlderLoad();
    await older;

    await expect(racingAtlas.getProjectionSnapshot()).resolves.toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({
          id: 'atlas:atlas.persistence',
          title: 'Newer Atlas Persistence',
        }),
      ]),
    });
    const after = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM projection_revisions',
    );
    expect(after.rows[0]!.count).toBe(before.rows[0]!.count + 1);
  }, 30_000);

  it('removes only identities absent from the current source inventory', async () => {
    const productFile = {
      path: 'plans/current/200-product.md',
      source: 'product',
      content: '# 200. Product Plan\n\nStatus: current\n',
    };
    let includeProduct = true;
    let revision = 5;
    const inventoryAtlas = createAtlasPostgresApplication({
      pool,
      loadProjection: async () => {
        const observedAt = `2026-09-02T0${revision}:00:00.000Z`;
        const projection = {
          evidenceFailures: [],
          evidenceSourceIds: ['atlas'],
          observedAt,
          observedPullRequests: [observedPullRequest],
          records: [...sourceFiles, ...(includeProduct ? [productFile] : [])].map(
            normalizeAtlasSourceRecord,
          ),
          sourceRevisions: [
            {
              ...sourceRevisions[0]!,
              id: `atlas:markdown:inventory-${revision}`,
              revision: `inventory-${revision}`,
              observedAt,
            },
            ...(includeProduct
              ? [
                  {
                    id: `product:markdown:inventory-${revision}`,
                    sourceId: 'product',
                    repository: 'acme/product',
                    authority: 'markdown' as const,
                    revision: `inventory-${revision}`,
                    revisionKind: 'git' as const,
                    observedAt,
                  },
                ]
              : []),
          ],
        };
        revision += 1;
        return projection;
      },
    });

    await inventoryAtlas.reconcile({ trigger: 'manual' });
    await expect(
      pool.query(
        'SELECT source_id, count(*)::int AS count FROM atlas_plans GROUP BY source_id ORDER BY source_id',
      ),
    ).resolves.toMatchObject({
      rows: [
        { source_id: 'atlas', count: 1 },
        { source_id: 'product', count: 1 },
      ],
    });

    includeProduct = false;
    await inventoryAtlas.reconcile({ trigger: 'manual' });
    await expect(
      pool.query(
        'SELECT source_id, count(*)::int AS count FROM atlas_plans GROUP BY source_id ORDER BY source_id',
      ),
    ).resolves.toMatchObject({ rows: [{ source_id: 'atlas', count: 1 }] });
    await expect(
      pool.query(
        "SELECT count(*)::int AS count FROM atlas_source_records WHERE source_id = 'product'",
      ),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
  }, 30_000);
});
