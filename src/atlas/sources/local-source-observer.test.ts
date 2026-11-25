import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { isAtlasSourceMarkdownPath, readLocalAtlasSourceRevision } from './markdown-source';
import { createSerializedDebouncedTask } from './local-source-observer';

const waitUntil = async (predicate: () => boolean, timeoutMs = 500) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for condition.');
    await new Promise(resolve => setTimeout(resolve, 2));
  }
};

describe('local Source observation', () => {
  it('recognizes only Atlas semantic source paths', () => {
    expect(isAtlasSourceMarkdownPath('plans/current/156.md')).toBe(true);
    expect(isAtlasSourceMarkdownPath('atlas/items/model/entity.md')).toBe(true);
    expect(isAtlasSourceMarkdownPath('packages/classroom/atlas.package.md')).toBe(true);
    expect(isAtlasSourceMarkdownPath('src/atlas/application.ts')).toBe(false);
    expect(isAtlasSourceMarkdownPath('.next/server/atlas.package.md.js')).toBe(false);
  });

  it('identifies local Source state from content rather than filesystem metadata', () => {
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'atlas-source-revision-'));
    try {
      const planDirectory = path.join(repoRoot, 'plans', 'current');
      const planPath = path.join(planDirectory, 'example.md');
      mkdirSync(planDirectory, { recursive: true });
      writeFileSync(planPath, '# Example\n');
      const revision = readLocalAtlasSourceRevision(repoRoot);
      const stats = statSync(planPath);
      utimesSync(planPath, stats.atime, new Date(stats.mtimeMs + 1_000));

      expect(readLocalAtlasSourceRevision(repoRoot)).toBe(revision);
      writeFileSync(planPath, '# Changed\n');
      expect(readLocalAtlasSourceRevision(repoRoot)).not.toBe(revision);
    } finally {
      rmSync(repoRoot, { recursive: true });
    }
  });

  it('coalesces bursts and serializes a change observed during reconciliation', async () => {
    const batches: string[][] = [];
    let releaseFirst: (() => void) | undefined;
    const firstRun = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    const task = createSerializedDebouncedTask(
      async reasons => {
        batches.push(reasons);
        if (batches.length === 1) await firstRun;
      },
      { delayMs: 1 },
    );

    task.schedule('plans/a.md');
    task.schedule('plans/b.md');
    await waitUntil(() => batches.length === 1);

    task.schedule('atlas/items/entity.md');
    task.schedule('atlas/items/entity.md');
    releaseFirst?.();
    await waitUntil(() => batches.length === 2);

    expect(batches).toEqual([
      ['plans/a.md', 'plans/b.md'],
      ['atlas/items/entity.md'],
    ]);
    task.close();
  });
});
