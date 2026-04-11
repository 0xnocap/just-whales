import { getPool } from './db';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getPool();
    const result = await db.query(`
      SELECT token_id::int as token_id, "to" as owner
      FROM (
        SELECT DISTINCT ON (token_id) token_id, "to"
        FROM transfers
        ORDER BY token_id, block_number DESC, vid DESC
      ) sub
      WHERE "to" != '0x0000000000000000000000000000000000000000'
      ORDER BY token_id
    `);

    // Return as a map: { tokenId: ownerAddress }
    const ownerMap: Record<string, string> = {};
    result.rows.forEach((r: any) => { ownerMap[r.token_id] = r.owner; });
    
    res.status(200).json(ownerMap);
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
