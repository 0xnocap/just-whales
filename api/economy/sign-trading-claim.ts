import { getPool } from '../_db.js';
import { createPublicClient, http, Address, parseAbi } from 'viem';
import { signTradingClaim } from '../_signer.js';
import { getEnvConfig } from '../_env.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const abi = parseAbi([
  'function tradingNonces(address) view returns (uint256)'
]);

function makeClient() {
  const env = getEnvConfig();
  return createPublicClient({
    chain: {
      id: env.chainId,
      name: 'Tempo',
      nativeCurrency: { name: 'Tempo', symbol: 'TMP', decimals: 18 },
      rpcUrls: { default: { http: [env.rpcUrl] } }
    },
    transport: http()
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { address } = req.body;
    if (!address || typeof address !== 'string') {
      res.status(400).json({ error: 'Missing or invalid address parameter' });
      return;
    }

    const cleanAddress = address.toLowerCase();
    const db = await getPool();
    const env = getEnvConfig();
    const claimer = env.requireRewardsClaimer();

    // 1. Unclaimed trading $OP (wei). Rate: 10 $OP per $1 pathUSD (6 decimals) → price * 10^13.
    //    Sales are aggregated by transaction_hash so multi-NFT purchases collapse to one row.
    //    Only claimed=TRUE rows are treated as tracked — pending rows stay claimable on retry.
    const salesResult = await db.query(`
      SELECT transaction_hash, SUM(price::numeric) as price
      FROM sales
      WHERE LOWER(buyer) = $1
      GROUP BY transaction_hash
    `, [cleanAddress]);

    const claimedResult = await db.query(`
      SELECT transaction_hash
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'purchase' AND claimed = TRUE
    `, [cleanAddress]);

    const claimedHashes = new Set(claimedResult.rows.map(r => r.transaction_hash));

    let totalUnclaimedOPWei = BigInt(0);
    const unclaimedSales: { hash: string; amount: bigint }[] = [];

    for (const sale of salesResult.rows) {
      if (!claimedHashes.has(sale.transaction_hash)) {
        const opWei = BigInt(sale.price) * BigInt(10**13);
        totalUnclaimedOPWei += opWei;
        unclaimedSales.push({ hash: sale.transaction_hash, amount: opWei });
      }
    }

    if (totalUnclaimedOPWei === BigInt(0)) {
      res.status(400).json({ error: 'No unclaimed trading rewards' });
      return;
    }

    // 2. Read current trading nonce
    const client = makeClient();
    const tradingNonce = await client.readContract({
      address: claimer as Address,
      abi,
      functionName: 'tradingNonces',
      args: [cleanAddress as Address]
    });

    // 3. Sign EIP-712 claim
    const signature = await signTradingClaim(cleanAddress as Address, totalUnclaimedOPWei, tradingNonce);

    // 4. Record pending claims. Do NOT mark as claimed; confirm-claim endpoint does that
    //    after on-chain tx succeeds. points_awarded is stored as wei.
    const dbClient = await db.connect();
    try {
      await dbClient.query('BEGIN');

      for (const sale of unclaimedSales) {
        await dbClient.query(`
          INSERT INTO economy_events (wallet, event_type, transaction_hash, points_awarded, claimed)
          VALUES ($1, 'purchase', $2, $3, FALSE)
          ON CONFLICT (wallet, event_type, transaction_hash)
          WHERE transaction_hash IS NOT NULL
          DO UPDATE SET points_awarded = EXCLUDED.points_awarded
        `, [cleanAddress, sale.hash, sale.amount.toString()]);
      }

      await dbClient.query(`
        INSERT INTO users (wallet, points_balance, lifetime_points)
        VALUES ($1, 0, 0)
        ON CONFLICT (wallet) DO UPDATE SET updated_at = NOW()
      `, [cleanAddress]);

      await dbClient.query('COMMIT');
    } catch (e) {
      await dbClient.query('ROLLBACK');
      throw e;
    } finally {
      dbClient.release();
    }

    res.status(200).json({
      amount: totalUnclaimedOPWei.toString(),
      nonce: Number(tradingNonce),
      signature,
      salesPending: unclaimedSales.length
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
