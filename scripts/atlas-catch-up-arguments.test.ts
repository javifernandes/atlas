import { describe, expect, it } from 'vitest';

import { parseAtlasCatchUpArguments } from './atlas-catch-up-arguments';

describe('Atlas catch-up CLI arguments', () => {
  it('accepts the pnpm argument separator before the recovery window', () => {
    expect(
      parseAtlasCatchUpArguments([
        '--',
        '--since=2026-09-07T00:00:00Z',
        '--apply',
      ]),
    ).toEqual({
      apply: true,
      since: '2026-09-07T00:00:00.000Z',
    });
  });

  it('defaults to preview without the separator', () => {
    expect(parseAtlasCatchUpArguments(['--since=2026-09-07T00:00:00Z'])).toEqual({
      apply: false,
      since: '2026-09-07T00:00:00.000Z',
    });
  });

  it('rejects missing, invalid, or conflicting recovery arguments', () => {
    expect(() => parseAtlasCatchUpArguments([])).toThrow('Usage:');
    expect(() => parseAtlasCatchUpArguments(['--since=not-a-date'])).toThrow(
      'valid ISO-8601',
    );
    expect(() =>
      parseAtlasCatchUpArguments([
        '--since=2026-09-07T00:00:00Z',
        '--dry-run',
        '--apply',
      ]),
    ).toThrow('Usage:');
  });
});
