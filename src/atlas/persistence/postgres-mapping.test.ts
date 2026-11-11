import { query } from '@ontahi/core/data-graph';
import {
  compilePostgresQuery,
  inferPostgresMappings,
} from '@ontahi/postgres/data-graph';
import { describe, expect, it } from 'vitest';

import {
  AtlasSourceRecord,
  ProjectionRevision,
  atlasEntities,
} from '../domain/atlas-application';
import { atlasPostgresMappingOverrides } from './postgres-mapping';

describe('Atlas PostgreSQL identity mappings', () => {
  it('maps Ontahí identity Entities onto Better Auth tables without credential fields', () => {
    const mappings = inferPostgresMappings(atlasEntities, {
      overrides: atlasPostgresMappingOverrides,
    });
    const user = mappings.find(mapping => mapping.entity.name === 'AtlasUser');
    const account = mappings.find(mapping => mapping.entity.name === 'AtlasAuthAccount');
    const stream = mappings.find(mapping => mapping.entity.name === 'AtlasExecutionStream');
    const streamRoot = mappings.find(
      mapping => mapping.entity.name === 'AtlasExecutionStreamRoot',
    );
    const streamActivity = mappings.find(
      mapping => mapping.entity.name === 'AtlasExecutionStreamActivity',
    );
    const workspaceSource = mappings.find(
      mapping => mapping.entity.name === 'AtlasWorkspaceSource',
    );
    const workspaceContributor = mappings.find(
      mapping => mapping.entity.name === 'AtlasWorkspaceContributor',
    );
    const typeBinding = mappings.find(mapping => mapping.entity.name === 'AtlasTypeBinding');

    expect(user).toMatchObject({
      table: 'atlas_auth_users',
      columns: {
        id: 'id',
        email: 'email',
        emailVerified: 'email_verified',
      },
    });
    expect(account).toEqual({
      entity: expect.objectContaining({ name: 'AtlasAuthAccount' }),
      table: 'atlas_auth_accounts',
      columns: {
        id: 'id',
        issuer: 'issuer',
        accountId: 'account_id',
        providerId: 'provider_id',
        userId: 'user_id',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    });
    expect(stream).toMatchObject({
      table: 'atlas_execution_streams',
      columns: {
        userId: 'user_id',
        currentFocusPlanId: 'current_focus_plan_id',
        openedAt: 'opened_at',
        closedAt: 'closed_at',
        archivedAt: 'archived_at',
        lastActivityAt: 'last_activity_at',
      },
    });
    expect(streamRoot).toMatchObject({
      table: 'atlas_execution_stream_roots',
      columns: { streamId: 'stream_id', planId: 'plan_id', addedAt: 'added_at' },
    });
    expect(streamActivity).toMatchObject({
      table: 'atlas_execution_stream_activities',
      columns: {
        streamId: 'stream_id',
        pullRequestId: 'pull_request_id',
        planId: 'plan_id',
        occurredAt: 'occurred_at',
      },
    });
    expect(workspaceSource).toMatchObject({
      table: 'atlas_workspace_sources',
      columns: {
        workspaceId: 'workspace_id',
        sourceId: 'source_id',
        contributorAccess: 'contributor_access',
      },
    });
    expect(workspaceContributor).toMatchObject({
      table: 'atlas_workspace_contributors',
      columns: {
        workspaceId: 'workspace_id',
        workspaceSourceId: 'workspace_source_id',
        providerAccountId: 'provider_account_id',
        contributionCount: 'contribution_count',
        lastContributedAt: 'last_contributed_at',
        linkedUserId: 'linked_user_id',
      },
    });
    expect(typeBinding).toMatchObject({
      table: 'atlas_type_bindings',
      columns: {
        sourceItemId: 'source_item_id',
        targetItemId: 'target_item_id',
      },
    });
  });

  it('physically excludes unselected wide columns from Atlas projections', () => {
    const mappings = inferPostgresMappings(atlasEntities, {
      overrides: atlasPostgresMappingOverrides,
    });
    const sourceRecordMapping = mappings.find(
      candidate => candidate.entity.name === 'AtlasSourceRecord',
    );
    const projectionRevisionMapping = mappings.find(
      candidate => candidate.entity.name === 'ProjectionRevision',
    );

    expect(sourceRecordMapping).toBeDefined();
    expect(
      compilePostgresQuery(
        query(AtlasSourceRecord).select(record => ({ id: record.id })),
        undefined,
        sourceRecordMapping!,
      ),
    ).toEqual({
      text: 'SELECT "id" AS "id" FROM "atlas_source_records" WHERE TRUE',
      values: [],
    });

    expect(projectionRevisionMapping).toBeDefined();
    expect(
      compilePostgresQuery(
        query(ProjectionRevision)
          .select(revision => ({ id: revision.id, startedAt: revision.startedAt }))
          .orderBy(revision => revision.startedAt.desc())
          .limit(1),
        undefined,
        projectionRevisionMapping!,
      ),
    ).toEqual({
      text:
        'SELECT "id" AS "id", "started_at" AS "startedAt"' +
        ' FROM "projection_revisions" WHERE TRUE' +
        ' ORDER BY "started_at" DESC NULLS LAST LIMIT 1',
      values: [],
    });
  });
});
