import { Pool, PoolClient } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const connectionString = (() => {
  const url = new URL(process.env.DATABASE_URL!);
  // Append search_path as a libpq connection option so it is applied by
  // PostgreSQL itself during connection setup, before any query can run.
  url.searchParams.set("options", "--search_path=router,public");
  return url.toString();
})();

const safePool = new Pool({ connectionString });

export const rawDb = {
  query: async (query: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> => {
    const result = await safePool.query(query, params ?? []);
    return { rows: result.rows };
  },

  /** Acquire a client for multi-statement transactions. Always release in finally. */
  getClient: async (): Promise<PoolClient> => {
    // search_path is already set at the connection level via the URL option,
    // but we set it explicitly here too for defence-in-depth in transactions.
    const client = await safePool.connect();
    await client.query("SET search_path TO router, public");
    return client;
  },
};
