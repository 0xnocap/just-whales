import { getPool } from '../../_db.js';
import { FREE_DAILY_ATTEMPTS, TACKLE_BOX_ATTEMPTS } from '../_gameData.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { address } = req.query;
    if (!address || typeof address !== 'string') {
      res.status(400).json({ error: 'Missing or invalid address parameter' });
      return;
    }

    const cleanAddress = address.toLowerCase();
    const db = await getPool();
    const today = new Date().toISOString().split('T')[0];

    // 1. Casts & Tackle Box status
    const attemptsResult = await db.query(`
      SELECT COUNT(*)::int as count
      FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'fish' AND created_at >= $2
    `, [cleanAddress, today]);

    const tackleBoxResult = await db.query(`
      SELECT COUNT(*)::int as count
      FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'tackle_box' AND created_at >= $2
    `, [cleanAddress, today]);

    const hasTackleBox = tackleBoxResult.rows[0].count > 0;
    const totalAllowed = FREE_DAILY_ATTEMPTS + (hasTackleBox ? TACKLE_BOX_ATTEMPTS : 0);
    const usedAttempts = attemptsResult.rows[0].count;

    // 2. Inventory (today's unclaimed/unredeemed catches)
    const inventoryResult = await db.query(`
      SELECT id, result, redeemed, prize_tier
      FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'fish' AND created_at >= $2
      ORDER BY created_at DESC
    `, [cleanAddress, today]);

    // 3. Discovered Fish IDs (lifetime)
    const journalResult = await db.query(`
      SELECT DISTINCT (result->>'id') as fish_id
      FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'fish'
    `, [cleanAddress]);

    // 4. Unclaimed fishing $OP (wei, from economy_events)
    const unclaimedResult = await db.query(`
      SELECT COALESCE(SUM(points_awarded), 0)::numeric as total
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'fish' AND claimed = FALSE
    `, [cleanAddress]);

    const unclaimedWei = BigInt(unclaimedResult.rows[0]?.total || 0);

    res.status(200).json({
      castsRemaining: Math.max(0, totalAllowed - usedAttempts),
      totalCasts: totalAllowed,
      tackleBoxPurchased: hasTackleBox,
      inventory: inventoryResult.rows.map(r => ({
        gameEventId: r.id,
        fish: typeof r.result === 'string' ? JSON.parse(r.result) : r.result,
        redeemed: r.redeemed,
        prizeTier: r.prize_tier
      })),
      discoveredFishIds: journalResult.rows.map(r => r.fish_id),
      unclaimedFishingOP: unclaimedWei.toString(),
      unclaimedFishingFormatted: (Number(unclaimedWei) / 1e18).toFixed(2)
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
