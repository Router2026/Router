require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a query with optional parameters.
 * @param {string} text - SQL query string
 * @param {Array} params - Parameterized values
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.LOG_QUERIES === 'true') {
      console.debug(`[DB] Query executed in ${duration}ms: ${text.slice(0, 80)}...`);
    }
    return result;
  } catch (err) {
    console.error(`[DB] Query failed: ${err.message}\nQuery: ${text}`);
    throw err;
  }
}

/**
 * Get a client from the pool for transactions.
 */
async function getClient() {
  return pool.connect();
}

/**
 * Look up region_id by name.
 * Cached in memory after first load.
 */
let regionCache = null;

async function getRegionMap() {
  if (regionCache) return regionCache;
  const result = await query('SELECT id, name FROM regions');
  regionCache = {};
  for (const row of result.rows) {
    regionCache[row.name] = row.id;
  }
  console.log(`[DB] Loaded ${Object.keys(regionCache).length} regions into cache.`);
  return regionCache;
}

async function end() {
  await pool.end();
}

module.exports = { query, getClient, getRegionMap, end };
