// Usage: npx tsx api/migrations/run.ts
// Runs every .sql file in this directory in alpha order against POSTGRES_URL.
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../_db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const pool = await getPool();
  const files = readdirSync(__dirname)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('no .sql files found');
    process.exit(0);
  }

  for (const file of files) {
    const sql = readFileSync(join(__dirname, file), 'utf8');
    console.log(`running ${file} ...`);
    await pool.query(sql);
    console.log(`ok ${file}`);
  }

  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' ORDER BY table_name`
  );
  console.log('\nTables in public schema:');
  for (const r of rows) console.log('  -', r.table_name);

  await pool.end();
  process.exit(0);
}

main().catch(e => {
  console.error('migration failed:', e);
  process.exit(1);
});
