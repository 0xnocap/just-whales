import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getPool();
    const seller = typeof req.query.seller === 'string' ? req.query.seller.toLowerCase() : null;

    // Select the latest status of every token_id
    // Since Goldsky sinks raw events, we find listings that haven't been sold yet.
    // We use DISTINCT ON to ensure only the latest listing for each token is returned.
    const result = await db.query(`
      WITH latest_listings AS (
        SELECT DISTINCT ON (l.token_id)
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
        ORDER BY l.token_id, l.timestamp DESC
      )
      SELECT * FROM latest_listings
      WHERE listing_id NOT IN (SELECT listing_id FROM sales)
        AND listing_id NOT IN (SELECT listing_id FROM canceled)
        ${seller ? 'AND LOWER(seller) = $1' : ''}
      ORDER BY price ASC
    `, seller ? [seller] : []);

    res.status(200).json(result.rows);
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
