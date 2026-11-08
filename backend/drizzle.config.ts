import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// Same precedence as `next dev`: .env.development.local (local Supabase) wins
// over .env.local (remote). dotenv never overwrites an already-set variable.
config({ path: ".env.development.local", quiet: true });
config({ path: ".env.local", quiet: true });

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
