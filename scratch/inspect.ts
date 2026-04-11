import { getPool } from '../api/_db.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

async function main() {
  const db = await getPool();
  try {
    const res = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
    console.log("Tables:", res.rows.map(r => r.table_name));

    const getCols = async (tbl) => {
      try {
        const r = await db.query(`SELECT * FROM ${tbl} LIMIT 1`);
        if (r.rows.length) {
          console.log(`Schema for ${tbl}:`, Object.keys(r.rows[0]));
        } else {
          const colRes = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [tbl]);
          console.log(`Schema for ${tbl} (empty):`, colRes.rows.map(c => c.column_name));
        }
      } catch (e) {
        console.error(`Error ${tbl}:`, e.message);
      }
    };

    await getCols('sales');
    await getCols('listed');
    await getCols('canceled');
    await getCols('transfers');
  } finally {
    process.exit(0);
  }
}

main();
