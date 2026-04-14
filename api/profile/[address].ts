import { getPool } from '../_db.js';
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
    
    const result = await db.query(`
      SELECT token_id::int as token_id
      FROM (
        SELECT DISTINCT ON (token_id) token_id, "to" as owner
        FROM transfers
        ORDER BY token_id, block_number DESC, vid DESC
      ) sub
      WHERE LOWER(owner) = $1
      ORDER BY token_id
    `, [cleanAddress]);
    
    // Activity for this address — all event types, staking/sale-dupes excluded
    const stakingAddr = (process.env.STAKING_CONTRACT || '').toLowerCase();
    const activity = await db.query(`
      SELECT a.*, tok.metadata->>'image_data' as image_data
      FROM (
        SELECT 'mint' as type, token_id::int as token_id, "from"::text, "to"::text, NULL::numeric as price, transaction_hash::text, timestamp::bigint as timestamp, block_number::bigint as block_number
        FROM transfers
        WHERE "from" = '0x0000000000000000000000000000000000000000'
          AND LOWER("to") = $1
        UNION ALL
        SELECT 'transfer' as type, token_id::int as token_id, "from"::text, "to"::text, NULL::numeric as price, transaction_hash::text, timestamp::bigint as timestamp, block_number::bigint as block_number
        FROM transfers
        WHERE "from" != '0x0000000000000000000000000000000000000000'
          AND LOWER("to")   != $2
          AND LOWER("from") != $2
          AND transaction_hash NOT IN (SELECT transaction_hash FROM sales)
          AND (LOWER("from") = $1 OR LOWER("to") = $1)
        UNION ALL
        SELECT 'sale' as type, token_id::int, seller::text, buyer::text, price::numeric, transaction_hash::text, timestamp::bigint, block_number::bigint
        FROM sales
        WHERE LOWER(seller) = $1 OR LOWER(buyer) = $1
        UNION ALL
        SELECT 'list' as type, token_id::int, seller::text, NULL::text, price::numeric, transaction_hash::text, timestamp::bigint, block_number::bigint
        FROM listed
        WHERE LOWER(seller) = $1
        UNION ALL
        SELECT 'cancel' as type, l.token_id::int, l.seller::text, NULL::text, NULL::numeric, c.transaction_hash::text, c.timestamp::bigint, c.block_number::bigint
        FROM canceled c LEFT JOIN listed l ON c.listing_id::numeric = l.listing_id::numeric
        WHERE LOWER(l.seller) = $1
        ORDER BY block_number DESC
        LIMIT 50
      ) a
      LEFT JOIN tokens tok ON a.token_id = tok.token_id::int
    `, [cleanAddress, stakingAddr]);

    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.status(200).json({
      address: cleanAddress,
      ownedTokenIds: result.rows.map((r: any) => r.token_id),
      activity: activity.rows,
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
