import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const TEST_WALLET = '0xffffffffffffffffffffffffffffffffffffffff';
  const TX = '0x' + 'a'.repeat(64);
  try {
    await pool.query(`DELETE FROM economy_events WHERE wallet = $1`, [TEST_WALLET]);

    // First insert
    await pool.query(`
      INSERT INTO economy_events (wallet, event_type, transaction_hash, points_awarded, claimed)
      VALUES ($1, 'purchase', $2, $3, FALSE)
      ON CONFLICT (wallet, event_type, transaction_hash) WHERE transaction_hash IS NOT NULL
      DO UPDATE SET points_awarded = EXCLUDED.points_awarded
    `, [TEST_WALLET, TX, '1000000000000000000']);
    console.log('insert 1 ok');

    // Second insert with different amount → upsert
    await pool.query(`
      INSERT INTO economy_events (wallet, event_type, transaction_hash, points_awarded, claimed)
      VALUES ($1, 'purchase', $2, $3, FALSE)
      ON CONFLICT (wallet, event_type, transaction_hash) WHERE transaction_hash IS NOT NULL
      DO UPDATE SET points_awarded = EXCLUDED.points_awarded
    `, [TEST_WALLET, TX, '2000000000000000000']);
    console.log('insert 2 ok (should upsert)');

    const r = await pool.query(`SELECT COUNT(*)::int as n, MAX(points_awarded) as amt FROM economy_events WHERE wallet = $1`, [TEST_WALLET]);
    console.log(`rows: ${r.rows[0].n} (expect 1), amt: ${r.rows[0].amt} (expect 2000000000000000000)`);

    // Fish event (NULL tx_hash) — multiple inserts should all succeed
    await pool.query(`INSERT INTO economy_events (wallet, event_type, points_awarded, claimed) VALUES ($1, 'fish', '100', FALSE)`, [TEST_WALLET]);
    await pool.query(`INSERT INTO economy_events (wallet, event_type, points_awarded, claimed) VALUES ($1, 'fish', '200', FALSE)`, [TEST_WALLET]);
    const fish = await pool.query(`SELECT COUNT(*)::int as n FROM economy_events WHERE wallet = $1 AND event_type = 'fish'`, [TEST_WALLET]);
    console.log(`fish rows: ${fish.rows[0].n} (expect 2)`);

    // Cleanup
    await pool.query(`DELETE FROM economy_events WHERE wallet = $1`, [TEST_WALLET]);
    console.log('cleanup ok');
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
