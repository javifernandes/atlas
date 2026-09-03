import { describe, expect, it } from 'vitest';

import { atlasViewerToPrincipal, decideAtlasReadAccess, type AtlasViewer } from './access';
import { readAtlasAuthConfiguration } from './config';

const viewer: AtlasViewer = {
  email: 'javi@example.com',
  id: 'github-user-1',
  image: null,
  name: 'Javi',
};

const privateConfiguration = readAtlasAuthConfiguration({
  ATLAS_AUTH_GITHUB_CLIENT_ID: 'github-client',
  ATLAS_AUTH_GITHUB_CLIENT_SECRET: 'github-secret',
  ATLAS_PRIVATE_GITHUB_USER_IDS: '12345',
  ATLAS_VISIBILITY: 'private',
  BETTER_AUTH_SECRET: 'a-high-entropy-secret-with-at-least-32-characters',
  BETTER_AUTH_URL: 'http://localhost:3000',
});

describe('Atlas read access', () => {
  it('maps the validated host user to an Ontahí Principal', () => {
    expect(atlasViewerToPrincipal(viewer)).toEqual({
      issuer: 'atlas:better-auth',
      kind: 'user',
      subject: 'github-user-1',
    });
  });

  it('allows anonymous public reads and requires a viewer for private reads', () => {
    expect(decideAtlasReadAccess(readAtlasAuthConfiguration({}), null).canRead).toBe(true);
    expect(decideAtlasReadAccess(privateConfiguration, null).canRead).toBe(false);
    expect(decideAtlasReadAccess(privateConfiguration, viewer).canRead).toBe(true);
  });

  it('fails closed when private configuration is invalid', () => {
    const configuration = readAtlasAuthConfiguration({ ATLAS_VISIBILITY: 'private' });
    const access = decideAtlasReadAccess(configuration, viewer);

    expect(access.canRead).toBe(false);
    expect(access.configurationError).not.toBeNull();
  });
});
