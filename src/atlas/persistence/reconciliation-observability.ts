import { SpanStatusCode, trace } from '@opentelemetry/api';

export type AtlasReconciliationStageMetrics = Record<
  string,
  boolean | number | string | null | undefined
>;

export type AtlasReconciliationStageObservation = AtlasReconciliationStageMetrics & {
  durationMs: number;
  event: 'atlas.projection.stage';
  repositoryFullName: string | null;
  stage: string;
  status: 'completed' | 'failed';
  trigger: string;
};

export type AtlasReconciliationStageObserver = {
  measure: <TValue>(
    stage: string,
    run: () => Promise<TValue>,
    metrics?: (value: TValue) => AtlasReconciliationStageMetrics,
  ) => Promise<TValue>;
  measureSync: <TValue>(
    stage: string,
    run: () => TValue,
    metrics?: (value: TValue) => AtlasReconciliationStageMetrics,
  ) => TValue;
  start: (
    stage: string,
  ) => (
    status: AtlasReconciliationStageObservation['status'],
    metrics?: AtlasReconciliationStageMetrics,
  ) => void;
};

const roundedDuration = (startedAt: number) =>
  Math.round((performance.now() - startedAt) * 100) / 100;

export const shouldObserveAtlasReconciliationStages = (
  environment: NodeJS.ProcessEnv = process.env,
) => {
  const configured = environment.ATLAS_RECONCILIATION_DIAGNOSTICS?.trim().toLowerCase();

  if (configured === '0' || configured === 'false' || configured === 'off') return false;
  if (configured === '1' || configured === 'true' || configured === 'on') return true;

  return environment.NODE_ENV === 'production';
};

export const createAtlasReconciliationStageObserver = (input: {
  enabled?: boolean;
  observe?: (observation: AtlasReconciliationStageObservation) => void;
  repositoryFullName?: string | null;
  trigger: string;
}): AtlasReconciliationStageObserver => {
  const enabled = input.enabled ?? shouldObserveAtlasReconciliationStages();
  const observe = input.observe ?? (observation => console.info(JSON.stringify(observation)));
  const report = (
    stage: string,
    status: AtlasReconciliationStageObservation['status'],
    startedAt: number,
    metrics: AtlasReconciliationStageMetrics = {},
  ) => {
    if (!enabled) return;

    observe({
      ...metrics,
      durationMs: roundedDuration(startedAt),
      event: 'atlas.projection.stage',
      repositoryFullName: input.repositoryFullName ?? null,
      stage,
      status,
      trigger: input.trigger,
    });
  };

  return {
    measure: async (stage, run, metrics) => {
      const startedAt = performance.now();

      try {
        const value = await run();
        report(stage, 'completed', startedAt, metrics?.(value));
        return value;
      } catch (error) {
        report(stage, 'failed', startedAt, {
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        throw error;
      }
    },
    measureSync: (stage, run, metrics) => {
      return trace.getTracer('atlas.reconciliation').startActiveSpan(stage, span => {
        const startedAt = performance.now();
        try {
          const value = run();
          const fields = metrics?.(value);
          for (const [key, field] of Object.entries(fields ?? {})) {
            if (field != null) span.setAttribute(`atlas.reconciliation.${key}`, field);
          }
          report(stage, 'completed', startedAt, fields);
          return value;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          report(stage, 'failed', startedAt, {
            errorName: error instanceof Error ? error.name : 'UnknownError',
          });
          throw error;
        } finally {
          span.end();
        }
      });
    },
    start: stage => {
      const startedAt = performance.now();
      let reported = false;

      return (status, metrics) => {
        if (reported) return;
        reported = true;
        report(stage, status, startedAt, metrics);
      };
    },
  };
};
