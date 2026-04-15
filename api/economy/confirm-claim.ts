import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Called by the frontend after on-chain claim succeeds.
 * Marks pending economy_events as confirmed (claimed = TRUE).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { address, type } = req.body;
    if (!address || !type) {
      res.status(400).json({ error: 'Missing address or type' });
      return;
    }

    const cleanAddress = address.toLowerCase();
    const eventType = type === 'trading' ? 'purchase' : type === 'fishing' ? 'fish' : null;
    if (!eventType) {
      res.status(400).json({ error: 'Invalid type. Use "trading" or "fishing".' });
      return;
    }

    const db = await getPool();
    const result = await db.query(`
      UPDATE economy_events
      SET claimed = TRUE, claim_tx_hash = $3
      WHERE LOWER(wallet) = $1 AND event_type = $2 AND claimed = FALSE
    `, [cleanAddress, eventType, req.body.txHash || null]);

    res.status(200).json({
      confirmed: result.rowCount || 0
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
