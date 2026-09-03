import { describe, expect, it } from 'vitest';

import {
  isGithubProfileAllowed,
  parsePrivateGithubUserIds,
  readAtlasAuthConfiguration,
} from './config';

const completeAuthEnvironment = {
  ATLAS_AUTH_GITHUB_CLIENT_ID: 'github-client',
  ATLAS_AUTH_GITHUB_CLIENT_SECRET: 'github-secret',
  BETTER_AUTH_SECRET: 'a-high-entropy-secret-with-at-least-32-characters',
  BETTER_AUTH_URL: 'http://localhost:3000',
};

describe('Atlas auth configuration', () => {
  it('defaults to an anonymous public viewer when auth is not configured', () => {
    expect(readAtlasAuthConfiguration({})).toMatchObject({
      authAvailable: false,
      configurationError: null,
      persistence: 'stateless',
      visibility: 'public',
    });
  });

  it('uses persistent auth when Atlas has a PostgreSQL database', () => {
    expect(
      readAtlasAuthConfiguration({
        ...completeAuthEnvironment,
        DATABASE_URL: 'postgresql://atlas:secret@localhost:5432/atlas',
      }),
    ).toMatchObject({
      databaseUrl: 'postgresql://atlas:secret@localhost:5432/atlas',
      persistence: 'postgres',
    });
  });

  it('fails private visibility closed when auth or its allowlist is incomplete', () => {
    expect(
      readAtlasAuthConfiguration({ ATLAS_VISIBILITY: 'private' }).configurationError,
    ).toContain('requires GitHub OAuth');
    expect(
      readAtlasAuthConfiguration({
        ...completeAuthEnvironment,
        ATLAS_VISIBILITY: 'private',
      }).configurationError,
    ).toContain('ATLAS_PRIVATE_GITHUB_USER_IDS');
  });

  it('normalizes the temporary GitHub user id allowlist', () => {
    expect([...parsePrivateGithubUserIds(' 12345,67890, 12345 ')]).toEqual([
      '12345',
      '67890',
    ]);
  });

  it('allows every GitHub profile in public mode and only configured profiles in private mode', () => {
    const publicConfiguration = readAtlasAuthConfiguration(completeAuthEnvironment);
    const privateConfiguration = readAtlasAuthConfiguration({
      ...completeAuthEnvironment,
      ATLAS_PRIVATE_GITHUB_USER_IDS: '12345',
      ATLAS_VISIBILITY: 'private',
    });

    expect(isGithubProfileAllowed(publicConfiguration, { id: 99999 })).toBe(true);
    expect(isGithubProfileAllowed(privateConfiguration, { id: '12345' })).toBe(true);
    expect(isGithubProfileAllowed(privateConfiguration, { id: 99999 })).toBe(false);
    expect(isGithubProfileAllowed(privateConfiguration, undefined)).toBe(false);
  });
});
