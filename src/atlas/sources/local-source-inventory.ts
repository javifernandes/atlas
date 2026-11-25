import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { listLocalAtlasSourcePaths } from './markdown-source';

type FileObservation = { mtimeMs: number; size: number; hash: string; content: string };
type Inventory = ReadonlyMap<string, FileObservation>;
type Change = { kind: 'put'; id: string; hash: string } | { kind: 'remove'; id: string };

export const observeLocalSourceInventory = (
  repoRoot: string,
  previous: Inventory = new Map(),
  options: { full?: boolean; hints?: readonly string[] } = {},
) => {
  const inventory = new Map<string, FileObservation>();
  const changes: Change[] = [];
  let filesRead = 0;

  for (const id of listLocalAtlasSourcePaths(repoRoot, repoRoot)) {
    const filePath = path.join(repoRoot, id);
    const { mtimeMs, size } = fs.statSync(filePath);
    const prior = previous.get(id);
    const hinted = options.hints?.some(hint => id === hint || id.startsWith(`${hint}/`));
    if (!options.full && !hinted && prior?.mtimeMs === mtimeMs && prior.size === size) {
      inventory.set(id, prior);
      continue;
    }

    const bytes = fs.readFileSync(filePath);
    const hash = createHash('sha256').update(bytes).digest('hex');
    filesRead += 1;
    inventory.set(id, { mtimeMs, size, hash, content: bytes.toString('utf8') });
    if (hash !== prior?.hash) changes.push({ kind: 'put', id, hash });
  }

  for (const id of previous.keys()) {
    if (!inventory.has(id)) changes.push({ kind: 'remove', id });
  }

  return { inventory, changes, filesRead };
};
