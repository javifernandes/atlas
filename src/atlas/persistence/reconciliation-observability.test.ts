import { describe, expect, it, vi } from 'vitest';

import {
  createAtlasReconciliationStageObserver,
  shouldObserveAtlasReconciliationStages,
} from './reconciliation-observability';

describe('Atlas reconciliation observability', () => {
  it('reports successful and failed stages without serializing error messages', async () => {
    const observe = vi.fn();
    const observer = createAtlasReconciliationStageObserver({
      enabled: true,
      observe,
      repositoryFullName: 'javifernandes/atlas',
      trigger: 'webhook',
    });

    await observer.measure('load-source', async () => ({ records: 3 }), value => ({
      recordCount: value.records,
    }));
    await expect(
      observer.measure('load-evidence', async () => {
        throw new TypeError('private token');
      }),
    ).rejects.toThrow('private token');

    expect(observe).toHaveBeenCalledTimes(2);
    expect(observe.mock.calls[0]?.[0]).toMatchObject({
      event: 'atlas.projection.stage',
      recordCount: 3,
      repositoryFullName: 'javifernandes/atlas',
      stage: 'load-source',
      status: 'completed',
      trigger: 'webhook',
    });
    expect(observe.mock.calls[1]?.[0]).toMatchObject({
      errorName: 'TypeError',
      stage: 'load-evidence',
      status: 'failed',
    });
    expect(JSON.stringify(observe.mock.calls)).not.toContain('private token');

    const finish = observer.start('publish');
    finish('completed', { itemCount: 2 });
    finish('failed');
    expect(observe.mock.calls.filter(call => call[0].stage === 'publish')).toHaveLength(1);
  });

  it('is production-default and explicitly configurable', () => {
    expect(shouldObserveAtlasReconciliationStages({ NODE_ENV: 'production' })).toBe(true);
    expect(shouldObserveAtlasReconciliationStages({ NODE_ENV: 'test' })).toBe(false);
    expect(
      shouldObserveAtlasReconciliationStages({
        ATLAS_RECONCILIATION_DIAGNOSTICS: 'on',
        NODE_ENV: 'test',
      }),
    ).toBe(true);
  });
});
