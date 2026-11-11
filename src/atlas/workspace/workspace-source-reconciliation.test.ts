import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { reconcileAtlasWorkspaceSources } from './workspace-source-reconciliation';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('Workspace Source reconciliation', () => {
  it('observes the intrinsic Atlas Source from the checkout outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-workspace-source-'));
    temporaryDirectories.push(repoRoot);
    fs.mkdirSync(path.join(repoRoot, 'examples', 'classroom', 'atlas', 'items'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(repoRoot, 'examples', 'classroom', 'atlas.package.md'),
      `---
id: atlas.examples.classroom
kind: package
title: Classroom
status: active
---
`,
    );
    fs.writeFileSync(
      path.join(repoRoot, 'examples', 'classroom', 'atlas', 'items', 'invitation.md'),
      `---
id: atlas.examples.classroom.invitation
kind: entity
title: Enrollment Invitation
parent: atlas.examples.classroom
status: shaping
---
`,
    );
    const fetcher = vi.fn(() => Promise.reject(new Error('GitHub should not be called')));

    const result = await reconcileAtlasWorkspaceSources({
      fetcher: fetcher as typeof fetch,
      repoRoot,
      sources: [{ id: 'atlas', ref: 'main', repository: 'javifernandes/atlas' }],
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.snapshot.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'package', semanticId: 'atlas.examples.classroom' }),
      expect.objectContaining({
        kind: 'entity', semanticId: 'atlas.examples.classroom.invitation',
      }),
    ]));
  });

  it('uses configured local roots for federated Sources outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-workspace-source-'));
    const ontahiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ontahi-workspace-source-'));
    temporaryDirectories.push(repoRoot, ontahiRoot);
    fs.writeFileSync(
      path.join(repoRoot, 'atlas.sources.local.yaml'),
      `version: 1
sources:
  ontahi:
    repository: https://github.com/javifernandes/ontahi
    localRoot: ${ontahiRoot}
    ref: main
`,
    );
    fs.writeFileSync(
      path.join(ontahiRoot, 'atlas.package.md'),
      `---
id: ontahi.examples.classroom
kind: package
title: Classroom
parent: ontahi
status: active
packageName: '@ontahi/example-classroom'
packageType: example
---
`,
    );
    const fetcher = vi.fn(() => Promise.reject(new Error('GitHub should not be called')));

    const result = await reconcileAtlasWorkspaceSources({
      fetcher: fetcher as typeof fetch,
      repoRoot,
      sources: [{ id: 'ontahi', ref: 'main', repository: 'javifernandes/ontahi' }],
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.snapshot.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        packageName: '@ontahi/example-classroom',
        semanticId: 'ontahi.examples.classroom',
        sourceId: 'ontahi',
      }),
    ]));
  });
});
