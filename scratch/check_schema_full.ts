
import { getPool } from '../api/_db.js';

async function checkSchema() {
  const db = await getPool();
  try {
    for (const table of ['listed', 'sales', 'canceled']) {
      const schema = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      console.log(`${table} Schema:`, schema.rows);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

checkSchema();
