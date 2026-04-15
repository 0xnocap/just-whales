import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const TEST_WALLET = '0x7831959816fAA58B5Dc869b7692cebdb6EFC311E'.toLowerCase();
const AMOUNT_WEI = '1000000000000000000'; // 1 $OP in wei

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const existing = await pool.query(
      `SELECT id, points_awarded, claimed FROM economy_events
       WHERE LOWER(wallet) = $1 AND event_type = 'fish' AND claimed = FALSE`,
      [TEST_WALLET]
    );
    if (existing.rows.length > 0) {
      console.log('Existing unclaimed fish events already present:');
      existing.rows.forEach(r => console.log(' ', r));
      console.log('Skipping seed.');
      return;
    }

    const result = await pool.query(
      `INSERT INTO economy_events (wallet, event_type, source_id, points_awarded, claimed)
       VALUES ($1, 'fish', 999999, $2, FALSE)
       RETURNING id, points_awarded`,
      [TEST_WALLET, AMOUNT_WEI]
    );
    console.log('Seeded:', result.rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
