import type { Pool, PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';

type PromiseQuery = <TRow extends QueryResultRow = QueryResultRow>(
  queryTextOrConfig: string | QueryConfig,
  values?: unknown[],
) => Promise<QueryResult<TRow>>;

const portablePostgresValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(portablePostgresValue);
  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, portablePostgresValue(nested)]),
    );
  }
  return value;
};

const portableRows = <TRow extends QueryResultRow>(result: QueryResult<TRow>) => ({
  ...result,
  rows: result.rows.map(row => portablePostgresValue(row) as TRow),
});

export const createPortableAtlasPostgresPool = (
  pool: Pick<Pool, 'connect' | 'query'>,
): Pick<Pool, 'connect' | 'query'> => {
  const wrapQuery = (query: PromiseQuery): PromiseQuery =>
    async <TRow extends QueryResultRow = QueryResultRow>(
      queryTextOrConfig: string | QueryConfig,
      values?: unknown[],
    ) => portableRows(await query<TRow>(queryTextOrConfig, values));

  const query = wrapQuery(pool.query.bind(pool) as unknown as PromiseQuery);
  const connect = async () => {
    const client = await pool.connect();
    const clientQuery = wrapQuery(client.query.bind(client) as unknown as PromiseQuery);

    return new Proxy(client, {
      get(target, property) {
        if (property === 'query') return clientQuery;

        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as PoolClient;
  };

  return {
    connect: connect as Pool['connect'],
    query: query as Pool['query'],
  };
};
