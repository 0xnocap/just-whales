import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const STAKING_ADDRESS = (process.env.STAKING_CONTRACT || '0x650F7fd9084b8631e16780A90BBed731679598F0').toLowerCase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getPool();
    const [holdersResult, mintedResult, transfersResult, volumeResult, stakedResult, salesResult] = await Promise.all([
      // Real holders: for each token's latest transfer, if currently held by staking
      // contract use the `from` (the staker), otherwise use `to` (the owner). Dedupe.
      db.query(`
        SELECT COUNT(DISTINCT CASE WHEN LOWER("to") = $1 THEN "from" ELSE "to" END) as holders
        FROM (
          SELECT DISTINCT ON (token_id) "to", "from"
          FROM transfers
          ORDER BY token_id, block_number DESC, vid DESC
        ) sub
        WHERE "to" != '0x0000000000000000000000000000000000000000'
      `, [STAKING_ADDRESS]),
      db.query(`SELECT COUNT(*) as minted FROM transfers WHERE "from" = '0x0000000000000000000000000000000000000000'`),
      db.query(`SELECT COUNT(*) as total FROM transfers WHERE "from" != '0x0000000000000000000000000000000000000000'`),
      db.query(`
        SELECT
          COALESCE(SUM(price::numeric), 0) as total_volume,
          COALESCE(SUM(CASE WHEN timestamp >= extract(epoch from now() - interval '24 hours') THEN price::numeric ELSE 0 END), 0) as volume_24h
        FROM sales
      `),
      db.query(`
        SELECT COUNT(*) as staked FROM (
          SELECT DISTINCT ON (token_id) "to" as owner
          FROM transfers
          ORDER BY token_id, block_number DESC, vid DESC
        ) sub
        WHERE LOWER(owner) = $1
      `, [STAKING_ADDRESS]),
      db.query(`SELECT COUNT(*) as total FROM sales`),
    ]);

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=180');
    res.status(200).json({
      holders: Number(holdersResult.rows[0].holders),
      totalMinted: Number(mintedResult.rows[0].minted),
      totalTransfers: Number(transfersResult.rows[0].total),
      totalVolume: Number(volumeResult.rows[0].total_volume) / 1e6, // normalize pathUSD decimals directly in API
      volume24h: Number(volumeResult.rows[0].volume_24h) / 1e6,
      staked: Number(stakedResult.rows[0].staked),
      salesCount: Number(salesResult.rows[0].total),
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
