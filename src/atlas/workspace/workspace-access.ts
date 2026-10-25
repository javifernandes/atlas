import type { Pool } from 'pg';

import { getAtlasPostgresPool } from '@/database/postgres-pool';

export const DEFAULT_ATLAS_WORKSPACE_ID = '00000000-0000-4000-8000-000000000137';

export type AtlasWorkspaceRole = 'owner' | 'editor' | 'viewer';

export type AtlasWorkspaceMember = {
  email: string;
  image: string | null;
  name: string;
  role: AtlasWorkspaceRole;
  userId: string;
};

export type AtlasWorkspaceAccess = {
  id: string;
  members: AtlasWorkspaceMember[];
  name: string;
  role: AtlasWorkspaceRole;
  slug: string;
  visibility: 'private' | 'public';
};

type WorkspaceAccessRow = {
  id: string;
  name: string;
  role: AtlasWorkspaceRole;
  slug: string;
  visibility: 'private' | 'public';
};

type WorkspaceMemberRow = {
  email: string;
  image: string | null;
  name: string;
  role: AtlasWorkspaceRole;
  user_id: string;
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
  const workspace = accessResult.rows[0];

  if (!workspace) {
    return null;
  }

  const membersResult = await query<WorkspaceMemberRow>(
    `
      SELECT
        membership.user_id,
        membership.role,
        users.name,
        users.email,
        users.image
      FROM atlas_workspace_memberships AS membership
      JOIN atlas_auth_users AS users ON users.id = membership.user_id
      WHERE membership.workspace_id = $1
        AND membership.status = 'active'
      ORDER BY
        CASE membership.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
        users.name ASC,
        users.id ASC
    `,
    [workspace.id],
  );

  return {
    ...workspace,
    members: membersResult.rows.map(member => ({
      email: member.email,
      image: member.image,
      name: member.name,
      role: member.role,
      userId: member.user_id,
    })),
  };
};

export const createAtlasWorkspaceAccessStore = (pool: Pick<Pool, 'connect' | 'query'>) => ({
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
