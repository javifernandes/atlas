import { describe, expect, it } from 'vitest';

import { getDirectionalNavigationTarget } from './spatial-keyboard-navigation';

const nodes = [
  { id: 'center', x: 100, y: 100 },
  { id: 'left', x: 20, y: 100 },
  { id: 'right', x: 180, y: 100 },
  { id: 'up', x: 100, y: 20 },
  { id: 'down', x: 100, y: 180 },
  { id: 'diagonal', x: 170, y: 180 },
];

describe('spatial keyboard navigation', () => {
  it.each([
    ['left', 'left'],
    ['right', 'right'],
    ['up', 'up'],
    ['down', 'down'],
  ] as const)('selects the nearest aligned node when moving %s', (direction, expected) => {
    expect(getDirectionalNavigationTarget('center', direction, nodes)?.id).toBe(expected);
  });

  it('returns no target when the direction has no candidate', () => {
    expect(getDirectionalNavigationTarget('left', 'left', nodes)).toBeUndefined();
  });
});
