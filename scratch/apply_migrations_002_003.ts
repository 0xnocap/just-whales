import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  const files = ['002_add_tx_hash_to_events.sql', '003_add_claimed_to_events.sql'];
  const migrationsDir = join(__dirname, '..', 'api', 'migrations');

  try {
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      console.log(`\n--- running ${file} ---`);
      console.log(sql);
      await pool.query(sql);
      console.log(`ok ${file}`);
    }

    console.log('\n=== post-migration economy_events columns ===');
    const cols = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'economy_events' ORDER BY ordinal_position
    `);
    cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    const required = ['transaction_hash', 'claimed', 'claim_tx_hash'];
    const present = new Set(cols.rows.map(r => r.column_name));
    const missing = required.filter(c => !present.has(c));
    if (missing.length > 0) {
      console.error('\nMISSING:', missing);
      process.exit(1);
    } else {
      console.log('\nAll required columns present.');
    }
  } catch (err) {
    console.error('migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
