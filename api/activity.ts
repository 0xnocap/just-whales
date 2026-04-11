import { getPool } from './_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getPool();
    const result = await db.query(`
      SELECT 
        'transfer' as type,
        token_id::int as token_id, 
        "from", 
        "to", 
        NULL as price,
        transaction_hash, 
        timestamp::bigint as timestamp, 
        block_number::bigint as block_number
      FROM transfers
      WHERE "from" != '0x0000000000000000000000000000000000000000'

      UNION ALL

      SELECT 
        'mint' as type,
        token_id::int as token_id, 
        "from", 
        "to", 
        NULL as price,
        transaction_hash, 
        timestamp::bigint as timestamp, 
        block_number::bigint as block_number
      FROM transfers
      WHERE "from" = '0x0000000000000000000000000000000000000000'

      UNION ALL

      SELECT 
        'sale' as type,
        token_id::int as token_id, 
        seller as "from", 
        buyer as "to", 
        price::numeric as price,
        transaction_hash, 
        timestamp::bigint as timestamp, 
        block_number::bigint as block_number
      FROM sales

      UNION ALL

      SELECT 
        'list' as type,
        token_id::int as token_id, 
        seller as "from", 
        NULL as "to", 
        price::numeric as price,
        transaction_hash, 
        timestamp::bigint as timestamp, 
        block_number::bigint as block_number
      FROM listed

      UNION ALL

      SELECT
        'cancel' as type,
        l.token_id::int as token_id,
        l.seller as "from",
        NULL as "to",
        NULL as price,
        c.transaction_hash,
        c.timestamp::bigint as timestamp,
        c.block_number::bigint as block_number
      FROM canceled c
      LEFT JOIN listed l ON c.listing_id::numeric = l.listing_id::numeric

      ORDER BY block_number DESC
      LIMIT 100
    `);
    res.status(200).json(result.rows);
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
