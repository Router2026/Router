// Applies an APPROVED batch of coordinate changes produced by fix-coordinates.ts.
// Writes to the database in DATABASE_URL (.env.local = production Supabase).
//
//   npx tsx scripts/apply-coordinates.ts --file <batch.json> --backup-table locations_backup_YYYYMMDD [--fix-geom-drift] --confirm
//
// Safety:
//  - Without --confirm it only prints what it would do.
//  - Creates the backup table (full copy of router.locations) if it doesn't exist yet.
//  - One transaction. Every row must still hold its "old" coordinates (optimistic check);
//    if any row changed since the report was made, everything is rolled back.
//  - latitude, longitude and geom are always written together.
// Restore one row: UPDATE router.locations l SET latitude=b.latitude, longitude=b.longitude, geom=b.geom
//                  FROM router.<backup> b WHERE b.id = l.id AND l.id = <id>;

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { Client } from "pg";

interface Change {
  id: number;
  name: string;
  old: { lat: number; lng: number };
  new: { lat: number; lng: number };
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const IN_ISRAEL = (p: { lat: number; lng: number }) => p.lat >= 29.4 && p.lat <= 33.45 && p.lng >= 34.2 && p.lng <= 35.95;

async function main() {
  const file = arg("file");
  const backup = arg("backup-table");
  if (!file || !backup || !/^locations_backup_\d{8}$/.test(backup)) {
    throw new Error("usage: --file <batch.json> --backup-table locations_backup_YYYYMMDD [--fix-geom-drift] [--confirm]");
  }
  const changes = JSON.parse(readFileSync(file, "utf8")) as Change[];
  for (const ch of changes) {
    if (!Number.isInteger(ch.id) || !IN_ISRAEL(ch.new)) throw new Error(`invalid change for id ${ch.id}`);
  }
  if (new Set(changes.map((c) => c.id)).size !== changes.length) throw new Error("duplicate ids in batch");

  const confirm = flag("confirm");
  console.log(`${confirm ? "APPLYING" : "DRY RUN"}: ${changes.length} coordinate changes${flag("fix-geom-drift") ? " + geom drift fix" : ""}`);

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query("SET search_path TO router, public");

    // 1. Backup (its own statement, committed before any change).
    const exists = await c.query(`SELECT to_regclass($1) t`, [`router.${backup}`]);
    if (!exists.rows[0].t) {
      if (confirm) {
        await c.query(`CREATE TABLE router.${backup} AS TABLE router.locations`);
        console.log(`backup created: router.${backup}`);
      } else {
        console.log(`would create backup: router.${backup}`);
      }
    } else {
      console.log(`backup exists: router.${backup}`);
    }
    if (confirm) {
      const [a, b] = await Promise.all([
        c.query(`SELECT count(*)::int n FROM router.locations`),
        c.query(`SELECT count(*)::int n FROM router.${backup}`),
      ]);
      if (a.rows[0].n !== b.rows[0].n) throw new Error(`backup row count ${b.rows[0].n} != live ${a.rows[0].n}; aborting`);
    }

    // 2. Changes, all-or-nothing.
    await c.query("BEGIN");
    let updated = 0;
    for (const ch of changes) {
      const r = await c.query(
        `UPDATE locations
            SET latitude = $2::numeric, longitude = $3::numeric,
                geom = ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326)::geography
          WHERE id = $1 AND latitude = $4::numeric AND longitude = $5::numeric
          RETURNING id`,
        [ch.id, ch.new.lat, ch.new.lng, ch.old.lat, ch.old.lng],
      );
      if (r.rowCount !== 1) throw new Error(`id ${ch.id} (${ch.name}) no longer has its reported coordinates; rolling back`);
      updated++;
    }
    let drift = 0;
    if (flag("fix-geom-drift")) {
      const r = await c.query(
        `UPDATE locations SET geom = ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography
          WHERE ST_Distance(geom, ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography) > 5
          RETURNING id`,
      );
      drift = r.rowCount ?? 0;
    }
    if (confirm) {
      await c.query("COMMIT");
      console.log(`committed: ${updated} coordinate updates, ${drift} geom drift fixes`);
    } else {
      await c.query("ROLLBACK");
      console.log(`dry run OK (rolled back): ${updated} would update, ${drift} drift fixes`);
    }
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await c.end();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
