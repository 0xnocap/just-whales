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
    
    // Activity for this address
    const activity = await db.query(`
      SELECT token_id::int as token_id, "from", "to", transaction_hash, timestamp::bigint as timestamp, block_number::bigint as block_number
      FROM transfers
      WHERE LOWER("from") = $1 OR LOWER("to") = $1
      ORDER BY block_number DESC
      LIMIT 50
    `, [cleanAddress]);

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
