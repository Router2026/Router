import { Pool, PoolClient, type PoolConfig } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const connectionString = (() => {
  const url = new URL(process.env.DATABASE_URL);
  // Append search_path as a libpq connection option so it is applied by
  // PostgreSQL itself during connection setup, before any query can run.
  url.searchParams.set("options", "--search_path=router,public");
  return url.toString();
})();

/**
 * TLS for every non-local database (Supabase). Without it the password and all data crossed the
 * internet unencrypted. Certificates are not verified yet (Supabase's CA is not bundled), which
 * still blocks passive sniffing; bundling the CA and setting rejectUnauthorized: true is the next
 * step. An explicit sslmode=disable in DATABASE_URL turns TLS off.
 */
export function sslFor(databaseUrl: string): PoolConfig["ssl"] {
  const url = new URL(databaseUrl);
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return false;
  if (url.searchParams.get("sslmode") === "disable") return false;
  return { rejectUnauthorized: false };
}

const safePool = new Pool({ connectionString, ssl: sslFor(process.env.DATABASE_URL) });

// Supabase's pooler closes idle connections. Without a listener, pg emits that as an unhandled
// 'error' event and Node exits the whole process. The pool drops the broken client on its own.
safePool.on("error", (err) => {
  console.error("[db] idle client error (connection dropped; the pool will reconnect):", err.message);
});

export const rawDb = {
  query: async <T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<{ rows: T[] }> => {
    const result = await safePool.query(query, params ?? []);
    return { rows: result.rows as T[] };
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
