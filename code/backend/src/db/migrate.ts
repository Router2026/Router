import fs from 'fs';
import path from 'path';
import { db } from '../config/db';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

async function runMigrations(): Promise<void> {
  console.log('Running migrations...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  const { rows: applied } = await db.query<{ name: string }>(
    'SELECT name FROM _migrations ORDER BY name'
  );

  const appliedSet = new Set(applied.map(r => r.name));

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`${file} already applied`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`Applying ${file}...`);

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`${file} applied`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`${file} FAILED:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log('All migrations complete');
  await db.end();
}

runMigrations().catch(err => {
  console.error('Migration error:', err);
  throw err;
});