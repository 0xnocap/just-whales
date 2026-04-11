import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getPool();
    
    // Select the latest status of every listingId
    // Since Goldsky sinks raw events, we find listings that haven't been sold yet.
    // We assume any listing that appears in 'sales' is no longer active.
    // Note: If 'cancelled' table is added later, we should also exclude those.
    const result = await db.query(`
      SELECT 
        l.listing_id, 
        l.seller, 
        l.nft_contract, 
        l.token_id::int as token_id, 
        l.price::numeric as price, 
        l.expires_at::numeric as expires_at,
        l.transaction_hash,
        l.timestamp::bigint as timestamp,
        t.metadata
      FROM listed l
      LEFT JOIN tokens t ON l.token_id::numeric = t.token_id::numeric
      WHERE l.listing_id NOT IN (SELECT listing_id FROM sales)
        AND l.listing_id NOT IN (SELECT listing_id FROM canceled)
      ORDER BY l.price ASC
    `);

    res.status(200).json(result.rows);
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
