import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ATLAS_WORKSPACE_ID,
  getAtlasWorkspaceAuthorityForUser,
  getAtlasWorkspaceForUser,
} from './workspace-access';

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
  });
});
