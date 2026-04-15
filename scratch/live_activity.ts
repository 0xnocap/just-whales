import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const r = await pool.query(`
      SELECT pid, usename, client_addr::text, application_name, state,
             query_start, LEFT(query, 200) AS q
      FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
      ORDER BY query_start DESC NULLS LAST
      LIMIT 30
    `);
    console.log(`=== ${r.rows.length} active sessions ===`);
    r.rows.forEach(row => {
      console.log(`pid=${row.pid} user=${row.usename} ip=${row.client_addr} app=${row.application_name} state=${row.state}`);
      console.log(`  start=${row.query_start?.toISOString?.() || 'null'}`);
      console.log(`  q=${row.q}`);
    });

    console.log('\n=== current economy_events columns ===');
    const c = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'economy_events' ORDER BY ordinal_position
    `);
    console.log(c.rows.map(x => x.column_name).join(', '));
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
