import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Rolling cap: 1000 $OP per 60-minute window, stored/compared in wei.
const ROLLING_CAP_WEI = BigInt(1000) * BigInt(10**18);
const WEI_PER_OP = BigInt(10**18);

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
    // game_events.points_earned is the plain $OP fish value (e.g. 50, 2500).
    // Convert to wei once, here, at the boundary into economy_events.
    const fishValuePlain = Number(event.points_earned);
    const fishValueWei = BigInt(fishValuePlain) * WEI_PER_OP;

    if (fishValuePlain === 0 && event.prize_tier) {
      res.status(400).json({ error: 'NFT prizes cannot be sold for points. Use the Claim button.' });
      return;
    }

    // 2. Apply rolling cap (wei)
    const capResult = await db.query(`
      SELECT COALESCE(SUM(points_awarded), 0)::numeric as total
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'fish' AND created_at >= NOW() - INTERVAL '1 hour'
    `, [cleanAddress]);

    const currentAccruedWei = BigInt(capResult.rows[0].total || 0);
    const remainingCapWei = ROLLING_CAP_WEI > currentAccruedWei ? ROLLING_CAP_WEI - currentAccruedWei : BigInt(0);

    const awardedWei = fishValueWei < remainingCapWei ? fishValueWei : remainingCapWei;
    const overflowWei = fishValueWei - awardedWei;

    // 3. Record. points_awarded stored as wei (uniform across all event_types).
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO economy_events (wallet, event_type, source_id, points_awarded, points_overflow, claimed)
        VALUES ($1, 'fish', $2, $3, $4, FALSE)
      `, [cleanAddress, gameEventId, awardedWei.toString(), overflowWei.toString()]);

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
      opEarned: Number(awardedWei / WEI_PER_OP),
      overflow: Number(overflowWei / WEI_PER_OP),
      capRemainingOP: Number((remainingCapWei - awardedWei) / WEI_PER_OP)
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
