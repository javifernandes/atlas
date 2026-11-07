import { describe, expect, it } from 'vitest';

import { resolveAtlasStorageMode } from './atlas-composition';

describe('Atlas storage composition', () => {
  it('keeps Auth and the Atlas domain on PostgreSQL whenever DATABASE_URL is configured', () => {
    expect(resolveAtlasStorageMode({ DATABASE_URL: 'postgresql://atlas.test/atlas' }))
      .toBe('postgres');
  });

  it('uses memory only without a database or under an explicit rollback', () => {
    expect(resolveAtlasStorageMode({})).toBe('memory');
    expect(resolveAtlasStorageMode({
      ATLAS_STORAGE_MODE: 'memory',
      DATABASE_URL: 'postgresql://atlas.test/atlas',
    })).toBe('memory');
  });
});
