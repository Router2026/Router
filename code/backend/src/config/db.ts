import { Pool } from 'pg';

export const db = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'router_db',
  user: 'postgres',
  password: 'omri0106',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

export async function checkDB(): Promise<void> {
  const client = await db.connect();
  try {
    const res = await client.query('SELECT version()');
    console.log('PostgreSQL connected:', res.rows[0].version.split(' ').slice(0, 2).join(' '));
  } finally {
    client.release();
  }
}