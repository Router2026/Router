import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const connectionString = (() => {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("options", "--search_path=router,public");
  return url.toString();
})();

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
