import 'dotenv/config';
import { getPool } from '../api/_db.js';

async function main() {
  const pool = await getPool();
  const { rows: tables } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  for (const t of tables) {
    const { rows: cols } = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [t.table_name]
    );
    const { rows: [count] } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "${t.table_name}"`
    );
    console.log(`\n${t.table_name}  (rows: ${count.n})`);
    for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type}`);
  }
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
