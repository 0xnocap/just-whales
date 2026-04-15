
import pg from 'pg';
import 'dotenv/config';

async function checkSchema() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log("--- Tables ---");
    for (const row of tablesResult.rows) {
      console.log(`\nTable: ${row.table_name}`);
      const columnsResult = await pool.query(`
        SELECT column_name, data_type 
        FROM (
          SELECT column_name, data_type, ordinal_position
          FROM information_schema.columns 
          WHERE table_name = '${row.table_name}'
        ) AS cols
        ORDER BY ordinal_position
      `);
      columnsResult.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkSchema();
