import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('=== database identity ===');
    const ident = await pool.query('SELECT current_database(), current_user, inet_server_addr(), inet_server_port()');
    console.log(ident.rows[0]);

    console.log('\n=== economy_events row count ===');
    const rows = await pool.query('SELECT COUNT(*)::int as n FROM economy_events');
    console.log(`  rows: ${rows.rows[0].n}`);

    console.log('\n=== economy_events table OID + creation time ===');
    const oid = await pool.query(`
      SELECT c.oid, c.relname, pg_catalog.obj_description(c.oid) as comment,
             (SELECT count(*) FROM pg_attribute WHERE attrelid = c.oid AND attnum > 0) as col_count
      FROM pg_class c
      WHERE c.relname = 'economy_events'
    `);
    console.log(oid.rows[0]);

    console.log('\n=== connected sessions (pg_stat_activity) ===');
    const sessions = await pool.query(`
      SELECT pid, application_name, client_addr, state, query_start,
             LEFT(query, 80) as last_query
      FROM pg_stat_activity
      WHERE datname = current_database()
      ORDER BY query_start DESC NULLS LAST
    `);
    sessions.rows.forEach(r => console.log(`  pid=${r.pid} app=${r.application_name} addr=${r.client_addr} state=${r.state} q=${r.last_query}`));
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
