import { getPool } from './db';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getPool();
    const result = await db.query(`
      SELECT token_id::int as token_id, "from", "to", transaction_hash, timestamp::bigint as timestamp, block_number::bigint as block_number
      FROM transfers
      ORDER BY block_number DESC
      LIMIT 50
    `);
    res.status(200).json(result.rows);
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
