// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchAtlasReleaseEvidence, parseAtlasReleaseNotes } from './release-evidence';

const originalAppId = process.env.ATLAS_GITHUB_APP_ID;
const originalPrivateKey = process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64;

afterEach(() => {
  if (originalAppId === undefined) delete process.env.ATLAS_GITHUB_APP_ID;
  else process.env.ATLAS_GITHUB_APP_ID = originalAppId;

  if (originalPrivateKey === undefined) delete process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64;
  else process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64 = originalPrivateKey;
});

describe('Atlas release evidence', () => {
  it('extracts Component Versions and explicit semantic bindings from Changesets notes', () => {
    expect(
      parseAtlasReleaseNotes({
        releaseId: 'release:21',
        body: `# Releases
## @ontahi/core@1.0.0-alpha.21

### Patch Changes

- abc1234: Move operation declarations behind the model boundary.

  Implements \`ontahi://plans/171-core-model-and-runtime-boundaries\`.

## @ontahi/react@1.0.0-alpha.21

### Patch Changes

- Updated dependencies [abc1234]
  - @ontahi/core@1.0.0-alpha.21`,
      }),
    ).toEqual([
      {
        commitShas: ['abc1234'],
        directives: [
          {
            kind: 'implements',
            target: 'ontahi://plans/171-core-model-and-runtime-boundaries',
          },
        ],
        id: 'release:21:@ontahi/core@1.0.0-alpha.21',
        notes:
          '### Patch Changes\n\n- abc1234: Move operation declarations behind the model boundary.\n\n  Implements `ontahi://plans/171-core-model-and-runtime-boundaries`.',
        packageName: '@ontahi/core',
        version: '1.0.0-alpha.21',
      },
      {
        commitShas: [],
        directives: [],
        id: 'release:21:@ontahi/react@1.0.0-alpha.21',
        notes:
          '### Patch Changes\n\n- Updated dependencies [abc1234]\n  - @ontahi/core@1.0.0-alpha.21',
        packageName: '@ontahi/react',
        version: '1.0.0-alpha.21',
      },
    ]);
  });

  it('loads published GitHub Releases and ignores drafts', async () => {
    delete process.env.ATLAS_GITHUB_APP_ID;
    delete process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64;
    const fetcherMock = vi.fn(async () =>
      Response.json([
        {
          id: 21,
          tag_name: 'v1.0.0-alpha.21',
          name: 'Ontahi 1.0.0-alpha.21',
          body: '## @ontahi/core@1.0.0-alpha.21\n\nImplements `ontahi://plans/171-core-model-and-runtime-boundaries`.',
          html_url: 'https://github.com/acme/ontahi/releases/tag/v1.0.0-alpha.21',
          published_at: '2026-11-21T01:34:37Z',
          prerelease: true,
          draft: false,
        },
        {
          id: 22,
          tag_name: 'v1.0.0-alpha.22',
          html_url: 'https://github.com/acme/ontahi/releases/tag/v1.0.0-alpha.22',
          published_at: null,
          prerelease: true,
          draft: true,
        },
      ]),
    );

    const releases = await fetchAtlasReleaseEvidence({
      fetcher: fetcherMock as typeof fetch,
      source: { sourceId: 'ontahi', repositoryFullName: 'acme/ontahi' },
    });

    expect(releases).toHaveLength(1);
    expect(releases[0]).toMatchObject({
      id: 'github-release:acme/ontahi#21',
      prerelease: true,
      publishedAt: '2026-11-21T01:34:37Z',
      sourceId: 'ontahi',
      tagName: 'v1.0.0-alpha.21',
    });
    expect(releases[0]?.componentVersions[0]).toMatchObject({
      packageName: '@ontahi/core',
      version: '1.0.0-alpha.21',
    });
    expect(fetcherMock).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/repos/acme/ontahi/releases' }),
      expect.any(Object),
    );
  });
});
