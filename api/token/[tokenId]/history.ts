import { getPool } from '../../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { tokenId } = req.query;
    if (!tokenId || typeof tokenId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid tokenId parameter' });
      return;
    }

    const db = await getPool();
    const result = await db.query(`
      SELECT "from", "to", transaction_hash, timestamp::bigint as timestamp, block_number::bigint as block_number
      FROM transfers
      WHERE token_id = $1
      ORDER BY block_number DESC, vid DESC
    `, [tokenId]);
    
    res.status(200).json(result.rows);
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
