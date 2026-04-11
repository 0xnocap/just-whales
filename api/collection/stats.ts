import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getPool();
    const [holdersResult, mintedResult, transfersResult, volumeResult] = await Promise.all([
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
      db.query(`
        SELECT 
          COALESCE(SUM(price::numeric), 0) as total_volume,
          COALESCE(SUM(CASE WHEN timestamp >= extract(epoch from now() - interval '24 hours') THEN price::numeric ELSE 0 END), 0) as volume_24h
        FROM sales
      `)
    ]);

    res.status(200).json({
      holders: Number(holdersResult.rows[0].holders),
      totalMinted: Number(mintedResult.rows[0].minted),
      totalTransfers: Number(transfersResult.rows[0].total),
      totalVolume: Number(volumeResult.rows[0].total_volume) / 1e6, // normalize pathUSD decimals directly in API
      volume24h: Number(volumeResult.rows[0].volume_24h) / 1e6,
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
