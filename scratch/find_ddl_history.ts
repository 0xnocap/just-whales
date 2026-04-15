/**
 * Query pg_stat_statements for any DDL touching economy_events.
 * Also lists recent statements by call frequency.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('=== DDL statements touching economy_events in pg_stat_statements ===');
    const ddl = await pool.query(`
      SELECT userid::regrole AS user, calls, total_exec_time::int AS total_ms,
             rows, LEFT(query, 500) AS q
      FROM pg_stat_statements
      WHERE query ILIKE '%economy_events%'
         OR query ILIKE '%DROP TABLE%'
         OR query ILIKE '%CREATE TABLE%'
         OR query ILIKE '%ALTER TABLE%'
      ORDER BY calls DESC
      LIMIT 30
    `);
    if (ddl.rows.length === 0) {
      console.log('(no matches)');
    } else {
      ddl.rows.forEach((row: any) => {
        console.log(`user=${row.user} calls=${row.calls} total_ms=${row.total_ms} rows=${row.rows}`);
        console.log(`  q=${row.q.replace(/\s+/g, ' ').slice(0, 300)}`);
        console.log('');
      });
    }

    console.log('\n=== Top 10 most-frequent queries (any kind) ===');
    const top = await pool.query(`
      SELECT userid::regrole AS user, calls, LEFT(query, 150) AS q
      FROM pg_stat_statements
      ORDER BY calls DESC
      LIMIT 10
    `);
    top.rows.forEach((row: any) => {
      console.log(`  user=${row.user} calls=${row.calls} q=${row.q.replace(/\s+/g, ' ').slice(0, 100)}`);
    });
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
