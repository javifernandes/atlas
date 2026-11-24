import { Pool, type PoolClient } from 'pg';

const FIXTURE_PROVIDER_ACCOUNT_ID = '999999999999999999';
const FIXTURE_LOGIN = 'atlas-invite-fixture';
const RECIPIENT_FIXTURE_INVITATION_ID = '00000000-0000-4000-8000-000000000201';
const RECIPIENT_FIXTURE_MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000202';
const RECIPIENT_FIXTURE_OWNER_ID = '00000000-0000-4000-8000-000000000203';
const RECIPIENT_FIXTURE_WORKSPACE_ID = '00000000-0000-4000-8000-000000000204';
const RECIPIENT_FIXTURE_WORKSPACE_SLUG = 'invitation-playground';

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');

const assertLocalDatabase = (value: string) => {
  const hostname = new URL(value).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error(
      `Refusing to modify non-local database host "${hostname}". This fixture is development-only.`,
    );
  }
};

const findWorkspace = async (client: PoolClient, slug: string) => {
  const result = await client.query<{ id: string; slug: string }>(
    `SELECT id, slug
       FROM atlas_workspaces
      WHERE slug = $1
      LIMIT 1`,
    [slug],
  );
  const workspace = result.rows[0];
  if (!workspace) throw new Error(`Workspace with slug "${slug}" does not exist.`);
  return workspace;
};

const seed = async (client: PoolClient, workspaceSlug: string) => {
  const workspace = await findWorkspace(client, workspaceSlug);
  const sourceResult = await client.query<{ id: string; source_id: string }>(
    `SELECT id, source_id
       FROM atlas_workspace_sources
      WHERE workspace_id = $1
        AND provider = 'github'
        AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1`,
    [workspace.id],
  );
  const source = sourceResult.rows[0];
  if (!source) {
    throw new Error(`Workspace "${workspace.slug}" has no active GitHub Source.`);
  }

  const fixtureId = `dev-fixture:invitation-candidate:${workspace.id}`;
  await client.query(
    `INSERT INTO atlas_workspace_contributors (
       id,
       workspace_id,
       workspace_source_id,
       source_id,
       provider,
       provider_account_id,
       login,
       avatar_url,
       kind,
       contribution_count,
       last_contributed_at,
       linked_user_id
     )
     VALUES ($1, $2, $3, $4, 'github', $5, $6, NULL, 'person', 1, CURRENT_TIMESTAMP, NULL)
     ON CONFLICT (id) DO UPDATE SET
       workspace_source_id = EXCLUDED.workspace_source_id,
       source_id = EXCLUDED.source_id,
       login = EXCLUDED.login,
       contribution_count = EXCLUDED.contribution_count,
       last_contributed_at = EXCLUDED.last_contributed_at,
       linked_user_id = NULL`,
    [fixtureId, workspace.id, source.id, source.source_id, FIXTURE_PROVIDER_ACCOUNT_ID, FIXTURE_LOGIN],
  );

  process.stdout.write(
    `Seeded @${FIXTURE_LOGIN} as an unlinked contributor in /${workspace.slug}.\n` +
      `Open http://localhost:3000/w/${workspace.slug}/settings and select People.\n`,
  );
};

const cleanup = async (client: PoolClient, workspaceSlug: string) => {
  const workspace = await findWorkspace(client, workspaceSlug);
  const invitations = await client.query(
    `DELETE FROM atlas_workspace_invitations
      WHERE workspace_id = $1
        AND recipient_provider = 'github'
        AND recipient_provider_account_id = $2`,
    [workspace.id, FIXTURE_PROVIDER_ACCOUNT_ID],
  );
  const contributors = await client.query(
    `DELETE FROM atlas_workspace_contributors
      WHERE workspace_id = $1
        AND provider = 'github'
        AND provider_account_id = $2`,
    [workspace.id, FIXTURE_PROVIDER_ACCOUNT_ID],
  );

  process.stdout.write(
    `Removed ${contributors.rowCount ?? 0} fixture contributor and ${invitations.rowCount ?? 0} fixture invitation(s) from /${workspace.slug}.\n`,
  );
};

const seedRecipient = async (client: PoolClient) => {
  const userResult = await client.query<{ email: string; id: string; name: string }>(
    `SELECT users.id, users.name, users.email
       FROM atlas_auth_sessions AS sessions
       JOIN atlas_auth_users AS users ON users.id = sessions.user_id
      WHERE sessions.expires_at > CURRENT_TIMESTAMP
      ORDER BY sessions.updated_at DESC
      LIMIT 1`,
  );
  const recipient = userResult.rows[0];
  if (!recipient) {
    throw new Error('No active local Atlas session found. Sign in locally, then run this fixture again.');
  }

  await client.query(
    `INSERT INTO atlas_auth_users (id, name, email, email_verified)
     VALUES ($1, 'Atlas Fixture Owner', 'atlas-fixture-owner@localhost.invalid', true)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP`,
    [RECIPIENT_FIXTURE_OWNER_ID],
  );
  await client.query(
    `INSERT INTO atlas_workspaces (id, slug, name, visibility)
     VALUES ($1, $2, 'Invitation Playground', 'private')
     ON CONFLICT (id) DO UPDATE SET
       slug = EXCLUDED.slug,
       name = EXCLUDED.name,
       visibility = EXCLUDED.visibility,
       updated_at = CURRENT_TIMESTAMP`,
    [RECIPIENT_FIXTURE_WORKSPACE_ID, RECIPIENT_FIXTURE_WORKSPACE_SLUG],
  );
  await client.query(
    `INSERT INTO atlas_workspace_memberships (id, workspace_id, user_id, role, status)
     VALUES ($1, $2, $3, 'owner', 'active')
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET
       role = 'owner',
       status = 'active',
       updated_at = CURRENT_TIMESTAMP`,
    [
      RECIPIENT_FIXTURE_MEMBERSHIP_ID,
      RECIPIENT_FIXTURE_WORKSPACE_ID,
      RECIPIENT_FIXTURE_OWNER_ID,
    ],
  );
  await client.query(
    `DELETE FROM atlas_workspace_memberships
      WHERE workspace_id = $1
        AND user_id = $2`,
    [RECIPIENT_FIXTURE_WORKSPACE_ID, recipient.id],
  );
  await client.query(
    `INSERT INTO atlas_workspace_invitations (
       id,
       workspace_id,
       invited_by_user_id,
       recipient_kind,
       recipient_user_id,
       claim_policy,
       proposed_role,
       status,
       expires_at
     )
     VALUES ($1, $2, $3, 'user', $4, 'known-user', 'collaborator', 'pending', CURRENT_TIMESTAMP + INTERVAL '7 days')
     ON CONFLICT (id) DO UPDATE SET
       recipient_user_id = EXCLUDED.recipient_user_id,
       proposed_role = EXCLUDED.proposed_role,
       status = 'pending',
       claimed_by_user_id = NULL,
       membership_id = NULL,
       expires_at = EXCLUDED.expires_at,
       updated_at = CURRENT_TIMESTAMP`,
    [
      RECIPIENT_FIXTURE_INVITATION_ID,
      RECIPIENT_FIXTURE_WORKSPACE_ID,
      RECIPIENT_FIXTURE_OWNER_ID,
      recipient.id,
    ],
  );

  process.stdout.write(
    `Seeded an invitation for ${recipient.name} <${recipient.email}>.\n` +
      `Open http://localhost:3000/invitations/${RECIPIENT_FIXTURE_INVITATION_ID}\n`,
  );
};

const cleanupRecipient = async (client: PoolClient) => {
  await client.query(`DELETE FROM atlas_workspaces WHERE id = $1`, [
    RECIPIENT_FIXTURE_WORKSPACE_ID,
  ]);
  await client.query(`DELETE FROM atlas_auth_users WHERE id = $1`, [RECIPIENT_FIXTURE_OWNER_ID]);
  process.stdout.write('Removed the local invitation recipient fixture.\n');
};

assertLocalDatabase(connectionString);

const mode = process.argv[2];
const workspaceSlug = process.argv[3] ?? 'atlas';
if (!['seed', 'cleanup', 'seed-recipient', 'cleanup-recipient'].includes(mode ?? '')) {
  throw new Error(
    'Usage: atlas-dev-invitation-fixture.ts <seed|cleanup|seed-recipient|cleanup-recipient> [workspace-slug]',
  );
}

const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  if (mode === 'seed') await seed(client, workspaceSlug);
  else if (mode === 'cleanup') await cleanup(client, workspaceSlug);
  else if (mode === 'seed-recipient') await seedRecipient(client);
  else await cleanupRecipient(client);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
