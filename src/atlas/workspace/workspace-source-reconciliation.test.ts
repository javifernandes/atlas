import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { reconcileAtlasWorkspaceSources } from './workspace-source-reconciliation';
import { observeLocalSourceInventory } from '../sources/local-source-inventory';
import {
  materializeLocalWorkspace,
  type LocalWorkspaceMaterialization,
} from './local-workspace-materialization';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('Workspace Source reconciliation', () => {
  it('reuses the watcher reading and parses only affected records across edits and removals', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-workspace-watch-'));
    temporaryDirectories.push(repoRoot);
    fs.mkdirSync(path.join(repoRoot, 'plans', 'current'), { recursive: true });
    const a = path.join(repoRoot, 'plans', 'current', '101-a.md');
    const b = path.join(repoRoot, 'plans', 'current', '102-b.md');
    fs.writeFileSync(a, '# Plan A\n');
    fs.writeFileSync(b, '# Plan B\n');
    const input = { repoRoot, sources: [{ id: 'atlas', ref: 'main', repository: 'javifernandes/atlas' }] };
    let inventory: ReturnType<typeof observeLocalSourceInventory>['inventory'] | undefined;
    let previous: LocalWorkspaceMaterialization | undefined;
    const reconcile = async () => {
      const observed = observeLocalSourceInventory(repoRoot, inventory);
      const read = vi.spyOn(fs, 'readFileSync');
      try {
        const result = await reconcileAtlasWorkspaceSources({
          ...input,
          localSourceFiles: Array.from(observed.inventory, ([filePath, file]) => ({
            path: filePath, content: file.content,
          })),
          parseSource: async source => {
            previous = await materializeLocalWorkspace(source, previous);
            return previous.materialization.source;
          },
        });
        expect(read.mock.calls.filter(([file]) => file === a || file === b)).toEqual([]);
        inventory = observed.inventory;
        return { result, filesRead: observed.filesRead };
      } finally {
        read.mockRestore();
      }
    };

    await reconcile();
    fs.writeFileSync(a, '# Plan A revised\n');
    const edited = await reconcile();
    expect(edited.filesRead).toBe(1);
    expect(previous?.materialization).toMatchObject({
      mode: 'incremental', parsedRecordCount: 1, reusedRecordCount: 1,
    });
    expect(edited.result.snapshot.nodes).toEqual((await reconcileAtlasWorkspaceSources(input)).snapshot.nodes);

    fs.unlinkSync(b);
    const removed = await reconcile();
    expect(removed.filesRead).toBe(0);
    expect(previous?.materialization).toMatchObject({
      mode: 'incremental', parsedRecordCount: 0, reusedRecordCount: 1,
    });
    const rebuilt = await reconcileAtlasWorkspaceSources(input);
    expect(removed.result.snapshot.nodes).toEqual(rebuilt.snapshot.nodes);
    expect(removed.result.snapshot.edges).toEqual(rebuilt.snapshot.edges);
    expect(removed.result.sourceRevisionSetHash).toBe(rebuilt.sourceRevisionSetHash);
  });
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
        itemModel: expect.objectContaining({
          kind: 'package',
          name: '@ontahi/example-classroom',
        }),
        semanticId: 'ontahi.examples.classroom',
        sourceId: 'ontahi',
      }),
    ]));
  });

  it('projects accepted Pull Request evidence into the Workspace snapshot', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-workspace-source-'));
    temporaryDirectories.push(repoRoot);
    fs.mkdirSync(path.join(repoRoot, 'atlas', 'items'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'plans', 'current'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, 'plans', 'current', '159-invitations.md'),
      '# 159. Invitations\n\nStatus: current\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'atlas', 'items', 'respond.md'),
      `---
id: atlas.workspace.respond
kind: interaction
title: Respond To Invitation
status: shaping
relatedPlans:
  - plans/current/159-invitations.md
---
`,
    );

    const result = await reconcileAtlasWorkspaceSources({
      observePullRequestEvidence: async ({ sources }) => {
        expect(sources).toEqual([
          { repositoryFullName: 'javifernandes/atlas', sourceId: 'atlas' },
        ]);
        return {
          failures: [],
          pullRequests: [{
            authorAvatarUrl: null,
            authorProviderAccountId: '1',
            authorLogin: 'javi',
            body: 'Atlas-Shapes: atlas.workspace.respond',
            directives: [{ kind: 'shapes', target: 'atlas.workspace.respond' }],
            id: 'github:javifernandes/atlas#116',
            mergeCommitSha: 'abc123',
            mergedByAvatarUrl: null,
            mergedByLogin: 'javi',
            mergedAt: '2026-11-24T01:52:58Z',
            number: 116,
            repositoryFullName: 'javifernandes/atlas',
            sourceId: 'atlas',
            title: 'Restore invitation evidence',
            url: 'https://github.com/javifernandes/atlas/pull/116',
          }],
        };
      },
      repoRoot,
      sources: [{ id: 'atlas', ref: 'main', repository: 'javifernandes/atlas' }],
    });

    expect(result.snapshot.evidence).toEqual([
      expect.objectContaining({
        kind: 'shapes',
        targetNodeId: 'atlas:atlas.workspace.respond',
        pullRequest: expect.objectContaining({ number: 116 }),
      }),
    ]);
  });
});
