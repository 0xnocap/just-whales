/**
 * Delete claimed=FALSE purchase rows for a wallet so the /rewards endpoint
 * can re-issue them. Safe because claimed=FALSE means nothing went on-chain.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const WALLET = '0x7831959816faa58b5dc869b7692cebdb6efc311e';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const before = await pool.query(
      `SELECT transaction_hash, claimed, points_awarded FROM economy_events
       WHERE LOWER(wallet) = $1 AND event_type = 'purchase'`,
      [WALLET]
    );
    console.log(`=== before: ${before.rows.length} rows ===`);
    before.rows.forEach(r => console.log(`  claimed=${r.claimed} tx=${r.transaction_hash} amt=${r.points_awarded}`));

    const del = await pool.query(
      `DELETE FROM economy_events
       WHERE LOWER(wallet) = $1 AND event_type = 'purchase' AND claimed = FALSE`,
      [WALLET]
    );
    console.log(`\ndeleted ${del.rowCount} claimed=FALSE rows`);

    const after = await pool.query(
      `SELECT COUNT(*)::int as n FROM economy_events
       WHERE LOWER(wallet) = $1 AND event_type = 'purchase'`,
      [WALLET]
    );
    console.log(`=== after: ${after.rows[0].n} rows remaining ===`);
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
