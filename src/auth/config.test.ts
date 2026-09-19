import { describe, expect, it } from 'vitest';

import { readAtlasAuthConfiguration } from './config';

const completeAuthEnvironment = {
  ATLAS_AUTH_GITHUB_CLIENT_ID: 'github-client',
  ATLAS_AUTH_GITHUB_CLIENT_SECRET: 'github-secret',
  BETTER_AUTH_SECRET: 'a-high-entropy-secret-with-at-least-32-characters',
  BETTER_AUTH_URL: 'http://localhost:3000',
};

describe('Atlas auth configuration', () => {
  it('defaults to a closed private viewer when auth is not configured', () => {
    expect(readAtlasAuthConfiguration({})).toMatchObject({
      authAvailable: false,
      configurationError: expect.stringContaining('requires GitHub OAuth'),
      persistence: 'stateless',
      visibility: 'private',
    });
  });

  it('allows an explicit public bypass without auth for local development', () => {
    expect(readAtlasAuthConfiguration({ ATLAS_VISIBILITY: 'public' })).toMatchObject({
      authAvailable: false,
      configurationError: null,
      visibility: 'public',
    });
  });

  it('fails closed when the public bypass is configured in production', () => {
    expect(
      readAtlasAuthConfiguration({
        ATLAS_VISIBILITY: 'public',
        NODE_ENV: 'production',
      }),
    ).toMatchObject({
      configurationError: 'Public Atlas visibility is available only in local development.',
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

  it('accepts any configured GitHub identity in private visibility', () => {
    expect(
      readAtlasAuthConfiguration({ ATLAS_VISIBILITY: 'private' }).configurationError,
    ).toContain('requires GitHub OAuth');
    expect(
      readAtlasAuthConfiguration({
        ...completeAuthEnvironment,
        ATLAS_VISIBILITY: 'private',
      }),
    ).toMatchObject({ configurationError: null, visibility: 'private' });
  });

  it('rejects unknown visibility values', () => {
    expect(
      readAtlasAuthConfiguration({
        ...completeAuthEnvironment,
        ATLAS_VISIBILITY: 'authenticated',
      }).configurationError,
    ).toContain('must be "private" or "public"');
  });
});
