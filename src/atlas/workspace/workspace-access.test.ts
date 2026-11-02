import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ATLAS_WORKSPACE_ID,
  getAtlasWorkspaceAuthorityForUser,
  getAtlasWorkspaceForUser,
  listAtlasWorkspacesForUser,
} from './workspace-access';
import { registerLocalWorkspace } from './local-workspace-registry';

describe('Atlas local Workspace access', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('provides an authenticated local user with the default Workspace without PostgreSQL', async () => {
    vi.stubEnv('DATABASE_URL', '');

    await expect(getAtlasWorkspaceForUser('local-user')).resolves.toEqual({
      id: DEFAULT_ATLAS_WORKSPACE_ID,
      name: 'Atlas',
      role: 'owner',
      slug: 'atlas',
      visibility: 'private',
    });
    await expect(getAtlasWorkspaceAuthorityForUser('local-user')).resolves.toEqual({
      id: DEFAULT_ATLAS_WORKSPACE_ID,
      role: 'owner',
    });
    await expect(getAtlasWorkspaceForUser('local-user', 'another')).resolves.toBeNull();
    await expect(listAtlasWorkspacesForUser('local-user')).resolves.toHaveLength(1);
  });

  it('resolves a locally created Workspace by slug for development compatibility', async () => {
    vi.stubEnv('DATABASE_URL', '');
    registerLocalWorkspace('local-dynamic-user', {
      id: 'workspace-local-dynamic',
      name: 'Local Dynamic',
      role: 'owner',
      slug: 'local-dynamic',
      visibility: 'private',
    });

    await expect(
      getAtlasWorkspaceForUser('local-dynamic-user', 'local-dynamic'),
    ).resolves.toMatchObject({ id: 'workspace-local-dynamic', role: 'owner' });
    await expect(listAtlasWorkspacesForUser('local-dynamic-user')).resolves.toHaveLength(2);
  });
});
