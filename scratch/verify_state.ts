import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function verify() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('=== economy_events column check ===');
    const cols = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'economy_events' ORDER BY ordinal_position
    `);
    console.log(cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    const hasClaimed = cols.rows.some(r => r.column_name === 'claimed');
    const hasTxHash = cols.rows.some(r => r.column_name === 'transaction_hash');
    const hasClaimTxHash = cols.rows.some(r => r.column_name === 'claim_tx_hash');
    console.log(`\nhas claimed column: ${hasClaimed}`);
    console.log(`has transaction_hash column: ${hasTxHash}`);
    console.log(`has claim_tx_hash column: ${hasClaimTxHash}`);

    console.log('\n=== reward_rates (check for migration 004 seeds) ===');
    const rates = await pool.query(`SELECT key, value FROM reward_rates ORDER BY key`);
    rates.rows.forEach(r => console.log(`  ${r.key} = ${r.value}`));

    console.log('\n=== economy_events row count ===');
    const count = await pool.query(`SELECT COUNT(*)::int as n FROM economy_events`);
    console.log(`  rows: ${count.rows[0].n}`);

    if (count.rows[0].n > 0) {
      const sample = await pool.query(`SELECT * FROM economy_events ORDER BY created_at DESC LIMIT 5`);
      console.log('  recent rows:');
      sample.rows.forEach(r => console.log('   ', JSON.stringify(r)));
    }

    console.log('\n=== game_events row count ===');
    const gc = await pool.query(`SELECT COUNT(*)::int as n FROM game_events`);
    console.log(`  rows: ${gc.rows[0].n}`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

verify();
