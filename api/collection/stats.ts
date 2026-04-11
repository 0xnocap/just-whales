import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getPool();
    const [holdersResult, mintedResult, transfersResult] = await Promise.all([
      db.query(`
        SELECT COUNT(DISTINCT owner) as holders FROM (
          SELECT DISTINCT ON (token_id) "to" as owner
          FROM transfers
          ORDER BY token_id, block_number DESC, vid DESC
        ) sub
        WHERE owner != '0x0000000000000000000000000000000000000000'
      `),
      db.query(`SELECT COUNT(*) as minted FROM transfers WHERE "from" = '0x0000000000000000000000000000000000000000'`),
      db.query(`SELECT COUNT(*) as total FROM transfers WHERE "from" != '0x0000000000000000000000000000000000000000'`),
    ]);

    res.status(200).json({
      holders: Number(holdersResult.rows[0].holders),
      totalMinted: Number(mintedResult.rows[0].minted),
      totalTransfers: Number(transfersResult.rows[0].total),
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
