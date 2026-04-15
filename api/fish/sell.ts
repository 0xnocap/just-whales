import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ROLLING_CAP = 1000;
const CAP_WINDOW_MINUTES = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { address, gameEventId } = req.body;
    if (!address || !gameEventId) {
      res.status(400).json({ error: 'Missing address or gameEventId' });
      return;
    }

    const cleanAddress = address.toLowerCase();
    const db = await getPool();

    // 1. Verify gameEventId
    const eventResult = await db.query(`
      SELECT * FROM game_events
      WHERE id = $1 AND LOWER(wallet) = $2 AND game = 'fish' AND redeemed = FALSE
    `, [gameEventId, cleanAddress]);

    if (eventResult.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or already redeemed catch' });
      return;
    }

    const event = eventResult.rows[0];
    const fishValue = Number(event.points_earned);

    if (fishValue === 0 && event.prize_tier) {
      res.status(400).json({ error: 'NFT prizes cannot be sold for points. Use the Claim button.' });
      return;
    }

    // 2. Apply rolling cap
    const capResult = await db.query(`
      SELECT SUM(points_awarded)::int as total
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'fish' AND created_at >= NOW() - INTERVAL '1 hour'
    `, [cleanAddress]);

    const currentAccrued = capResult.rows[0].total || 0;
    const remainingCap = Math.max(0, ROLLING_CAP - currentAccrued);
    
    const awarded = Math.min(fishValue, remainingCap);
    const overflow = fishValue - awarded;

    // 3. Record and update. points_awarded stored as plain integer $OP (e.g. 50);
    //    conversion to wei happens at claim time in sign-fishing-claim.ts.
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO economy_events (wallet, event_type, source_id, points_awarded, points_overflow, claimed)
        VALUES ($1, 'fish', $2, $3, $4, FALSE)
      `, [cleanAddress, gameEventId, awarded, overflow]);

      await client.query(`
        UPDATE game_events SET redeemed = TRUE WHERE id = $1
      `, [gameEventId]);

      await client.query(`
        INSERT INTO users (wallet, points_balance, lifetime_points)
        VALUES ($1, 0, 0)
        ON CONFLICT (wallet) DO UPDATE SET updated_at = NOW()
      `, [cleanAddress]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.status(200).json({ 
      sold: true, 
      opEarned: awarded, 
      overflow, 
      capRemaining: Math.max(0, remainingCap - awarded)
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
