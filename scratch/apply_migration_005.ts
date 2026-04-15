import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const sql = fs.readFileSync(path.join('api/migrations', '005_unique_event_tx_hash.sql'), 'utf8');
    console.log('applying 005_unique_event_tx_hash.sql');
    console.log(sql);
    await pool.query(sql);

    const idx = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'economy_events'
      ORDER BY indexname
    `);
    console.log('\neconomy_events indexes:');
    idx.rows.forEach(r => console.log(`  ${r.indexname}`));
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
