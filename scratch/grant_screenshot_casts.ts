
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function grantCasts() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  const address = '0x7831959816fAA58B5Dc869b7692cebdb6EFC311E'.toLowerCase();
  const today = new Date().toISOString().split('T')[0];

  try {
    console.log(`Checking state for ${address}...`);
    
    // 1. Clear today's fishing events to reset the counter
    const deleteResult = await pool.query(
      "DELETE FROM game_events WHERE LOWER(wallet) = $1 AND game = 'fish' AND created_at >= $2",
      [address, today]
    );
    console.log(`Reset ${deleteResult.rowCount} of today's casts.`);

    // 2. Ensure a tackle box event exists for today to boost max casts to 15
    const tackleBoxCheck = await pool.query(
      "SELECT id FROM game_events WHERE LOWER(wallet) = $1 AND game = 'tackle_box' AND created_at >= $2",
      [address, today]
    );

    if (tackleBoxCheck.rows.length === 0) {
      await pool.query(
        "INSERT INTO game_events (wallet, game, result, points_earned) VALUES ($1, 'tackle_box', $2, 0)",
        [address, JSON.stringify({ dev_grant: true, reason: 'screenshot_mode' })]
      );
      console.log('Granted a Tackle Box to increase daily limit to 15.');
    } else {
      console.log('Wallet already has an active Tackle Box for today.');
    }

    console.log('\nSuccess! Wallet should now show 15 casts available.');
  } catch (err) {
    console.error('Error granting casts:', err);
  } finally {
    await pool.end();
  }
}

grantCasts();
