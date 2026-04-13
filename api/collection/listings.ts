import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getPool();
    const seller = typeof req.query.seller === 'string' ? req.query.seller.toLowerCase() : null;

    // Filter sold/canceled listings before selecting the latest per token.
    // This ensures that if the most recent listing is canceled/sold, we can 
    // potentially pick up an older active listing (though unlikely in a clean state,
    // it's more robust for indexing edge cases).
    const result = await db.query(`
      WITH active_listings AS (
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
      )
      SELECT DISTINCT ON (token_id) *
      FROM active_listings
      ${seller ? 'WHERE LOWER(seller) = $1' : ''}
      ORDER BY token_id, timestamp DESC
    `, seller ? [seller] : []);

    // After DISTINCT ON, we need to sort by price for the marketplace grid
    const rows = result.rows
      .map((r: any) => {
        if (r.metadata) {
          const { image_data, ...rest } = r.metadata;
          return { ...r, metadata: rest };
        }
        return r;
      })
      .sort((a, b) => Number(a.price) - Number(b.price));

    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
    res.status(200).json(rows);
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
