
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function setExactCasts() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  const address = '0x7831959816fAA58B5Dc869b7692cebdb6EFC311E'.toLowerCase();
  const today = new Date().toISOString().split('T')[0];

  try {
    console.log(`Setting state for ${address}...`);
    
    // 1. Clear today's fishing events first
    await pool.query(
      "DELETE FROM game_events WHERE LOWER(wallet) = $1 AND game = 'fish' AND created_at >= $2",
      [address, today]
    );

    // 2. Ensure Tackle Box exists (Total = 20)
    const tackleBoxCheck = await pool.query(
      "SELECT id FROM game_events WHERE LOWER(wallet) = $1 AND game = 'tackle_box' AND created_at >= $2",
      [address, today]
    );
    if (tackleBoxCheck.rows.length === 0) {
      await pool.query(
        "INSERT INTO game_events (wallet, game, result, points_earned) VALUES ($1, 'tackle_box', $2, 0)",
        [address, JSON.stringify({ dev_grant: true })]
      );
    }

    // 3. Add 10 "empty" casts today so 20 total - 10 used = 10 remaining
    for (let i = 0; i < 10; i++) {
      await pool.query(
        "INSERT INTO game_events (wallet, game, result, points_earned) VALUES ($1, 'fish', $2, 0)",
        [address, JSON.stringify({ result: 'no_bite', dev: true })]
      );
    }

    console.log('\nSuccess! With the new 10 free + 10 tackle box limit (20 total),');
    console.log('we used 10 "mock" casts so you have exactly 10 remaining.');
  } catch (err) {
    console.error('Error setting casts:', err);
  } finally {
    await pool.end();
  }
}

setExactCasts();
