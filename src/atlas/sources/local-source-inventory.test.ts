import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { observeLocalSourceInventory } from './local-source-inventory';

describe('local source inventory', () => {
  let root: string;
  let file: string;
  const timestamp = new Date('2026-01-01T00:00:00Z');

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-source-'));
    fs.mkdirSync(path.join(root, 'plans'));
    file = path.join(root, 'plans', 'a.md');
    fs.writeFileSync(file, 'old');
    fs.utimesSync(file, timestamp, timestamp);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rereads only candidates and emits no change for a touch', () => {
    fs.writeFileSync(path.join(root, 'plans', 'b.md'), 'unchanged');
    const { inventory } = observeLocalSourceInventory(root);
    const later = new Date('2026-01-02T00:00:00Z');
    fs.utimesSync(file, later, later);
    const read = vi.spyOn(fs, 'readFileSync');

    const touched = observeLocalSourceInventory(root, inventory);
    expect(touched.changes).toEqual([]);
    expect(read.mock.calls).toEqual([[file]]);
    expect(observeLocalSourceInventory(root, touched.inventory).filesRead).toBe(0);
  });

  it('emits a removal after a successful inventory scan', () => {
    const { inventory } = observeLocalSourceInventory(root);
    fs.unlinkSync(file);

    expect(observeLocalSourceInventory(root, inventory)).toMatchObject({
      changes: [{ kind: 'remove', id: 'plans/a.md' }],
      filesRead: 0,
    });
  });

  it('preserves the previous inventory if reading a candidate fails', () => {
    const { inventory } = observeLocalSourceInventory(root);
    fs.writeFileSync(file, 'new content');
    const read = vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
      throw new Error('read failed');
    });

    expect(() => observeLocalSourceInventory(root, inventory)).toThrow('read failed');
    read.mockRestore();
    expect(observeLocalSourceInventory(root, inventory).changes).toEqual([
      expect.objectContaining({ kind: 'put', id: 'plans/a.md' }),
    ]);
  });

  it('detects same-size, same-mtime edits with a hint or full validation', () => {
    const { inventory } = observeLocalSourceInventory(root);
    fs.writeFileSync(file, 'new');
    fs.utimesSync(file, timestamp, timestamp);

    expect(observeLocalSourceInventory(root, inventory).filesRead).toBe(0);
    const hinted = observeLocalSourceInventory(root, inventory, { hints: ['plans/a.md'] });
    const validated = observeLocalSourceInventory(root, inventory, { full: true });
    expect(validated.filesRead).toBe(1);
    expect(validated.changes).toEqual([
      expect.objectContaining({ kind: 'put', id: 'plans/a.md' }),
    ]);
    expect(hinted.changes).toEqual(validated.changes);
  });
});
