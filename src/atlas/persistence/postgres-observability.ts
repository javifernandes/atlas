import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

import type { Pool, PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';

export type AtlasPostgresQueryContext = {
  operation: string;
  trigger?: string;
};

export type AtlasPostgresQueryObservation = {
  durationMs: number;
  event: 'atlas.postgres.query';
  operation: string | null;
  payloadBytes: number;
  query: string;
  rowCount: number;
  statement: string;
  table: string | null;
  trigger: string | null;
};

type PromiseQuery = <TRow extends QueryResultRow = QueryResultRow>(
  queryTextOrConfig: string | QueryConfig,
  values?: unknown[],
) => Promise<QueryResult<TRow>>;

const queryContext = new AsyncLocalStorage<AtlasPostgresQueryContext>();

export const withAtlasPostgresQueryContext = <TValue>(
  context: AtlasPostgresQueryContext,
  run: () => TValue,
) => queryContext.run(context, run);

const queryText = (queryTextOrConfig: string | QueryConfig) =>
  typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;

const queryIdentity = (sql: string) => {
  const statement = sql.trimStart().match(/^([a-z]+)/i)?.[1]?.toLowerCase() ?? 'unknown';
  const table =
    sql.match(/\bdelete\s+from\s+"?([a-z_][a-z0-9_]*)"?/i)?.[1] ??
    sql.match(/\b(?:from|into|update|join)\s+"?([a-z_][a-z0-9_]*)"?/i)?.[1] ??
    null;
  const fingerprint = createHash('sha256')
    .update(sql.replaceAll(/\s+/g, ' ').trim())
    .digest('hex')
    .slice(0, 12);

  return {
    query: `${table ? `${statement}.${table}` : statement}.${fingerprint}`,
    statement,
    table,
  };
};

const resultPayloadBytes = (rows: QueryResultRow[]) => {
  if (rows.length === 0) return 0;

  try {
    return Buffer.byteLength(
      JSON.stringify(rows, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
      'utf8',
    );
  } catch {
    return 0;
  }
};

const defaultObserver = (observation: AtlasPostgresQueryObservation) => {
  console.info(JSON.stringify(observation));
};

export const shouldObserveAtlasPostgresQueries = (
  environment: NodeJS.ProcessEnv = process.env,
) => {
  const configured = environment.ATLAS_POSTGRES_DIAGNOSTICS?.trim().toLowerCase();

  if (configured === '0' || configured === 'false' || configured === 'off') return false;
  if (configured === '1' || configured === 'true' || configured === 'on') return true;

  return environment.NODE_ENV === 'production';
};

export const instrumentAtlasPostgresPool = (
  pool: Pick<Pool, 'connect' | 'query'>,
  options: {
    enabled?: boolean;
    observe?: (observation: AtlasPostgresQueryObservation) => void;
  } = {},
): Pick<Pool, 'connect' | 'query'> => {
  if (!(options.enabled ?? shouldObserveAtlasPostgresQueries())) return pool;

  const observe = options.observe ?? defaultObserver;
  const wrapQuery = (query: PromiseQuery): PromiseQuery => {
    const observedQuery: PromiseQuery = async <TRow extends QueryResultRow = QueryResultRow>(
      queryTextOrConfig: string | QueryConfig,
      values?: unknown[],
    ) => {
      const startedAt = performance.now();
      const result = await query<TRow>(queryTextOrConfig, values);
      const identity = queryIdentity(queryText(queryTextOrConfig));
      const context = queryContext.getStore();

      observe({
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        event: 'atlas.postgres.query',
        operation: context?.operation ?? null,
        payloadBytes: resultPayloadBytes(result.rows),
        query: identity.query,
        rowCount: result.rows.length,
        statement: identity.statement,
        table: identity.table,
        trigger: context?.trigger ?? null,
      });

      return result;
    };

    return observedQuery;
  };

  const observedPoolQuery = wrapQuery(pool.query.bind(pool) as unknown as PromiseQuery);
  const connect = async () => {
    const client = await pool.connect();
    const observedClientQuery = wrapQuery(client.query.bind(client) as unknown as PromiseQuery);

    return new Proxy(client, {
      get(target, property) {
        if (property === 'query') return observedClientQuery;

        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as PoolClient;
  };

  return {
    connect: connect as Pool['connect'],
    query: observedPoolQuery as Pool['query'],
  };
};
