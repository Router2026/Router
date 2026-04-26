import { Pool, PoolClient } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("connect", (client) => {
  client.query("SET search_path TO router, public");
});

export const rawDb = {
  query: async (query: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> => {
    const result = await pool.query(query, params ?? []);
    return { rows: result.rows };
  },

  /** Acquire a client for multi-statement transactions. Always release in finally. */
  getClient: async (): Promise<PoolClient> => {
    const client = await pool.connect();
    await client.query("SET search_path TO router, public");
    return client;
  },
};
