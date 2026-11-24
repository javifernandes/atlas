import { describe, expect, it } from 'vitest';

import {
  atlasItemKinds,
  getEntityItemModel,
  getPackageItemModel,
  isAtlasItemKind,
  normalizeAtlasItemKind,
} from './item-kind';

describe('Atlas Item Kind extension surface', () => {
  it('uses one canonical authored-kind catalog and rejects projection-only node kinds', () => {
    expect(atlasItemKinds).toContain('entity');
    expect(isAtlasItemKind('package')).toBe(true);
    expect(isAtlasItemKind('item')).toBe(true);
    expect(isAtlasItemKind('concept')).toBe(false);
    expect(isAtlasItemKind('plan')).toBe(false);
    expect(isAtlasItemKind('candidate')).toBe(false);
    expect(normalizeAtlasItemKind('concept')).toBe('item');
    expect(normalizeAtlasItemKind('system-primitive')).toBe('item');
    expect(normalizeAtlasItemKind('not-a-kind')).toBeUndefined();
  });

  it('reads current typed models and legacy snapshot fields during rollout', () => {
    expect(
      getPackageItemModel({
        itemModel: { kind: 'package', name: '@ontahi/classroom', path: 'examples/classroom' },
        kind: 'package',
      }),
    ).toEqual({ kind: 'package', name: '@ontahi/classroom', path: 'examples/classroom' });

    expect(
      getPackageItemModel({
        kind: 'package',
        packageName: '@ontahi/legacy',
        packagePath: 'examples/legacy',
      }),
    ).toEqual({
      kind: 'package',
      name: '@ontahi/legacy',
      packageType: undefined,
      path: 'examples/legacy',
    });

    const entity = { fields: [], invariants: [], operations: [], relations: [], states: [] };
    expect(getEntityItemModel({ entityModel: entity, kind: 'entity' })).toEqual({
      entity,
      kind: 'entity',
    });
  });
});
