import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const rawDb = {
  query: async (query: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> => {
    const result = await pool.query(query, params ?? []);
    return { rows: result.rows };
  },
};
