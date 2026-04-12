import { getPool } from '../api/_db.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const db = await getPool();
  try {
    const res = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
    console.log("Tables:", res.rows.map(r => r.table_name));

    try {
      const sales = await db.query(`SELECT * FROM sales LIMIT 1`);
      console.log("Sales schema:", Object.keys(sales.rows[0] || {}));
    } catch (e) { console.error("Sales err", e.message); }

    try {
      const listings = await db.query(`SELECT * FROM listed LIMIT 1`);
      console.log("Listed schema:", Object.keys(listings.rows[0] || {}));
    } catch (e) { console.error("Listed err", e.message); }

    try {
      const canceled = await db.query(`SELECT * FROM canceled LIMIT 1`);
      console.log("Canceled schema:", Object.keys(canceled.rows[0] || {}));
    } catch (e) { console.error("Canceled err", e.message); }
  } finally {
    process.exit(0);
  }
}
main();
