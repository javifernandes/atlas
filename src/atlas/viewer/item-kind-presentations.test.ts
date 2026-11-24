import { describe, expect, it } from 'vitest';

import {
  getItemKindPresentation,
  getItemKindSectionPresentation,
} from './item-kind-presentations';

describe('Item Kind presentation contract', () => {
  it('keeps specialized detail and evolution behavior in one presentation definition', () => {
    expect(getItemKindPresentation('package')).toMatchObject({
      detail: { overview: 'package-details' },
      evolution: 'descendant-plans',
      visualRole: 'container',
    });
    expect(getItemKindSectionPresentation('entity', 'States')).toBe('entity-behavior');
  });

  it('gives simple Markdown kinds a useful default without registration', () => {
    expect(getItemKindPresentation('capability')).toEqual({
      detail: undefined,
      evolution: 'self',
      visualRole: 'shape',
    });
    expect(getItemKindSectionPresentation('operation', 'States')).toBeUndefined();
  });

  it('presents a neutral Collection as structural without restoring legacy category semantics', () => {
    expect(getItemKindPresentation('collection')).toEqual({
      detail: undefined,
      evolution: 'self',
      visualRole: 'container',
    });
  });

  it('registers the typed Operation realization overview', () => {
    expect(getItemKindPresentation('operation')).toMatchObject({
      detail: { overview: 'operation-details' },
    });
  });
});
