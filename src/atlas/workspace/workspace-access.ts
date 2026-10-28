import type { Pool } from 'pg';

import { getAtlasPostgresPool } from '@/database/postgres-pool';

export const DEFAULT_ATLAS_WORKSPACE_ID = '00000000-0000-4000-8000-000000000137';

export type AtlasWorkspaceRole = 'owner' | 'editor' | 'viewer';

export type AtlasWorkspaceAccess = {
  id: string;
  name: string;
  role: AtlasWorkspaceRole;
  slug: string;
  visibility: 'private' | 'public';
};

export type AtlasWorkspaceAuthority = Pick<AtlasWorkspaceAccess, 'id' | 'role'>;

type WorkspaceAccessRow = {
  id: string;
  name: string;
  role: AtlasWorkspaceRole;
  slug: string;
  visibility: 'private' | 'public';
};

const readWorkspaceAuthority = async (
  query: Pick<Pool, 'query'>['query'],
  userId: string,
): Promise<AtlasWorkspaceAuthority | null> => {
  const accessResult = await query<AtlasWorkspaceAuthority>(
    `
      SELECT
        workspace.id,
        membership.role
      FROM atlas_workspace_memberships AS membership
      JOIN atlas_workspaces AS workspace ON workspace.id = membership.workspace_id
      WHERE membership.user_id = $1
        AND membership.workspace_id = $2
        AND membership.status = 'active'
      ORDER BY
        CASE membership.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
        membership.created_at ASC
      LIMIT 1
    `,
    [userId, DEFAULT_ATLAS_WORKSPACE_ID],
  );
  return accessResult.rows[0] ?? null;
};

const readWorkspaceAccess = async (
  query: Pick<Pool, 'query'>['query'],
  userId: string,
): Promise<AtlasWorkspaceAccess | null> => {
  const accessResult = await query<WorkspaceAccessRow>(
    `
      SELECT
        workspace.id,
        workspace.slug,
        workspace.name,
        workspace.visibility,
        membership.role
      FROM atlas_workspace_memberships AS membership
      JOIN atlas_workspaces AS workspace ON workspace.id = membership.workspace_id
      WHERE membership.user_id = $1
        AND membership.workspace_id = $2
        AND membership.status = 'active'
      ORDER BY
        CASE membership.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
        membership.created_at ASC
      LIMIT 1
    `,
    [userId, DEFAULT_ATLAS_WORKSPACE_ID],
  );
  return accessResult.rows[0] ?? null;
};

export const createAtlasWorkspaceAccessStore = (pool: Pick<Pool, 'connect' | 'query'>) => ({
  resolveAuthorityForUser: async (userId: string): Promise<AtlasWorkspaceAuthority | null> => {
    const existing = await readWorkspaceAuthority(pool.query.bind(pool), userId);

    if (existing) return existing;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('atlas:default-workspace-owner'))");
      await client.query(
        `
          INSERT INTO atlas_workspace_memberships (workspace_id, user_id, role, status)
          SELECT $1, users.id, 'owner', 'active'
          FROM atlas_auth_users AS users
          WHERE users.id = $2
            AND NOT EXISTS (
              SELECT 1
              FROM atlas_workspace_memberships
              WHERE workspace_id = $1
            )
          ON CONFLICT (workspace_id, user_id) DO NOTHING
        `,
        [DEFAULT_ATLAS_WORKSPACE_ID, userId],
      );
      const authority = await readWorkspaceAuthority(client.query.bind(client), userId);
      await client.query('COMMIT');

      return authority;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  resolveForUser: async (userId: string): Promise<AtlasWorkspaceAccess | null> => {
    const existing = await readWorkspaceAccess(pool.query.bind(pool), userId);

    if (existing) {
      return existing;
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('atlas:default-workspace-owner'))");
      await client.query(
        `
          INSERT INTO atlas_workspace_memberships (workspace_id, user_id, role, status)
          SELECT $1, users.id, 'owner', 'active'
          FROM atlas_auth_users AS users
          WHERE users.id = $2
            AND NOT EXISTS (
              SELECT 1
              FROM atlas_workspace_memberships
              WHERE workspace_id = $1
            )
          ON CONFLICT (workspace_id, user_id) DO NOTHING
        `,
        [DEFAULT_ATLAS_WORKSPACE_ID, userId],
      );
      const access = await readWorkspaceAccess(client.query.bind(client), userId);
      await client.query('COMMIT');

      return access;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
});

export const getAtlasWorkspaceForUser = async (
  userId: string,
): Promise<AtlasWorkspaceAccess | null> => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return null;
  }

  return createAtlasWorkspaceAccessStore(
    getAtlasPostgresPool(connectionString),
  ).resolveForUser(userId);
};

export const getAtlasWorkspaceAuthorityForUser = async (
  userId: string,
): Promise<AtlasWorkspaceAuthority | null> => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) return null;

  return createAtlasWorkspaceAccessStore(
    getAtlasPostgresPool(connectionString),
  ).resolveAuthorityForUser(userId);
};
