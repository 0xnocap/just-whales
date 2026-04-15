/**
 * Polls pg_stat_activity every 2 seconds, logging any session currently
 * running DDL (CREATE/DROP/ALTER) against economy_events or any migration-
 * ish file reference. Also logs column-count changes for economy_events.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  let lastColCount = 0;

  while (true) {
    try {
      const cols = await pool.query(`
        SELECT COUNT(*)::int AS n FROM information_schema.columns
        WHERE table_name = 'economy_events'
      `);
      const n = cols.rows[0].n;
      if (n !== lastColCount) {
        const now = new Date().toISOString();
        console.log(`[${now}] economy_events column count: ${lastColCount} -> ${n}`);
        const listing = await pool.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'economy_events' ORDER BY ordinal_position
        `);
        console.log(`  cols: ${listing.rows.map((r: any) => r.column_name).join(', ')}`);
        lastColCount = n;
      }

      const activity = await pool.query(`
        SELECT pid, usename, client_addr::text, application_name, state,
               query_start, LEFT(query, 400) AS q
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND (query ILIKE '%DROP TABLE%'
               OR query ILIKE '%CREATE TABLE%economy_events%'
               OR query ILIKE '%ALTER TABLE%economy_events%'
               OR query ILIKE '%DROP COLUMN%'
               OR query ILIKE '%economy_schema%'
               OR query ILIKE '%migrations/%')
      `);
      if (activity.rows.length > 0) {
        const now = new Date().toISOString();
        activity.rows.forEach((row: any) => {
          console.log(`[${now}] DDL DETECTED pid=${row.pid} user=${row.usename} ip=${row.client_addr} app="${row.application_name}" state=${row.state}`);
          console.log(`  q=${row.q.replace(/\s+/g, ' ').slice(0, 300)}`);
        });
      }
    } catch (err: any) {
      console.error(`poll error: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
