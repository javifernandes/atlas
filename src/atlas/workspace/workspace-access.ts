import type { Pool } from 'pg';

import { getAtlasPostgresPool } from '@/database/postgres-pool';
import { listLocalWorkspaces } from './local-workspace-registry';

export const DEFAULT_ATLAS_WORKSPACE_ID = '00000000-0000-4000-8000-000000000137';

export const LOCAL_ATLAS_WORKSPACE: AtlasWorkspaceAccess = {
  id: DEFAULT_ATLAS_WORKSPACE_ID,
  name: 'Atlas',
  role: 'owner',
  slug: 'atlas',
  visibility: 'private',
};

export type AtlasWorkspaceRole = 'owner' | 'collaborator' | 'viewer';

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
  slug?: string,
): Promise<AtlasWorkspaceAuthority | null> => {
  const accessResult = await query<AtlasWorkspaceAuthority>(
    `
      SELECT
        workspace.id,
        membership.role
      FROM atlas_workspace_memberships AS membership
      JOIN atlas_workspaces AS workspace ON workspace.id = membership.workspace_id
      WHERE membership.user_id = $1
        AND membership.status = 'active'
        AND ($2::text IS NULL OR workspace.slug = $2)
      ORDER BY
        CASE membership.role WHEN 'owner' THEN 0 WHEN 'collaborator' THEN 1 ELSE 2 END,
        membership.created_at ASC
      LIMIT 1
    `,
    [userId, slug ?? null],
  );
  return accessResult.rows[0] ?? null;
};

const readWorkspaceAccess = async (
  query: Pick<Pool, 'query'>['query'],
  userId: string,
  slug?: string,
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
        AND membership.status = 'active'
        AND ($2::text IS NULL OR workspace.slug = $2)
      ORDER BY
        CASE membership.role WHEN 'owner' THEN 0 WHEN 'collaborator' THEN 1 ELSE 2 END,
        membership.created_at ASC
      LIMIT 1
    `,
    [userId, slug ?? null],
  );
  return accessResult.rows[0] ?? null;
};

const listWorkspaceAccess = async (
  query: Pick<Pool, 'query'>['query'],
  userId: string,
): Promise<AtlasWorkspaceAccess[]> => {
  const result = await query<WorkspaceAccessRow>(
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
        AND membership.status = 'active'
      ORDER BY workspace.name ASC, workspace.slug ASC
    `,
    [userId],
  );
  return result.rows;
};

export const createAtlasWorkspaceAccessStore = (pool: Pick<Pool, 'query'>) => ({
  listForUser: (userId: string) => listWorkspaceAccess(pool.query.bind(pool), userId),
  resolveAuthorityForUser: (userId: string, slug?: string) =>
    readWorkspaceAuthority(pool.query.bind(pool), userId, slug),
  resolveForUser: (userId: string, slug?: string) =>
    readWorkspaceAccess(pool.query.bind(pool), userId, slug),
});

export const getAtlasWorkspaceForUser = async (
  userId: string,
  slug?: string,
): Promise<AtlasWorkspaceAccess | null> => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    const workspaces = [LOCAL_ATLAS_WORKSPACE, ...listLocalWorkspaces(userId)];
    return slug
      ? (workspaces.find(workspace => workspace.slug === slug) ?? null)
      : (workspaces[0] ?? null);
  }

  return createAtlasWorkspaceAccessStore(
    getAtlasPostgresPool(connectionString),
  ).resolveForUser(userId, slug);
};

export const listAtlasWorkspacesForUser = async (
  userId: string,
): Promise<AtlasWorkspaceAccess[]> => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return [LOCAL_ATLAS_WORKSPACE, ...listLocalWorkspaces(userId)];
  return createAtlasWorkspaceAccessStore(
    getAtlasPostgresPool(connectionString),
  ).listForUser(userId);
};

export const getAtlasWorkspaceAuthorityForUser = async (
  userId: string,
  slug?: string,
): Promise<AtlasWorkspaceAuthority | null> => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    const workspace = await getAtlasWorkspaceForUser(userId, slug);
    return workspace ? { id: workspace.id, role: workspace.role } : null;
  }

  return createAtlasWorkspaceAccessStore(
    getAtlasPostgresPool(connectionString),
  ).resolveAuthorityForUser(userId, slug);
};
