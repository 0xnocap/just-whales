import 'dotenv/config';
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  const wallet = '0x7831959816faa58b5dc869b7692cebdb6efc311e';
  
  // Clear existing test rewards first to be safe
  await pool.query('DELETE FROM economy_events WHERE wallet = $1 AND source_id = 999999', [wallet]);
  
  await pool.query(
    "INSERT INTO economy_events (wallet, event_type, source_id, points_awarded, claimed) VALUES ($1, 'fish', 999999, 50, FALSE)",
    [wallet]
  );
  console.log('Seeded 50 $OP fishing reward for', wallet);
  
  await pool.end();
}

main().catch(console.error);
