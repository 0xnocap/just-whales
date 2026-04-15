import { getPool } from '../../_db.js';
import { createPublicClient, http, Address, parseAbi } from 'viem';
import { getEnvConfig } from '../../_env.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const abi = parseAbi([
  'function tradingNonces(address) view returns (uint256)',
  'function fishingNonces(address) view returns (uint256)'
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
  try {
    const { address } = req.query;
    if (!address || typeof address !== 'string') {
      res.status(400).json({ error: 'Missing or invalid address parameter' });
      return;
    }

    const cleanAddress = address.toLowerCase();
    const db = await getPool();
    const env = getEnvConfig();

    // 1a. Total NFT purchase count (one row per NFT in sales)
    const salesCountResult = await db.query(
      `SELECT COUNT(*)::int as n FROM sales WHERE LOWER(buyer) = $1`,
      [cleanAddress]
    );
    const totalPurchases = salesCountResult.rows[0]?.n || 0;

    // 1b. Aggregate sales by transaction_hash (multi-NFT tx = one economy_events row)
    const salesResult = await db.query(`
      SELECT transaction_hash, SUM(price::numeric) as price
      FROM sales
      WHERE LOWER(buyer) = $1
      GROUP BY transaction_hash
    `, [cleanAddress]);

    // 2. Only CLAIMED events count as tracked. Pending (claimed=FALSE) rows are in-flight
    //    signatures the user may retry, so they must still show as unclaimed.
    const claimedResult = await db.query(`
      SELECT transaction_hash
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'purchase' AND claimed = TRUE
    `, [cleanAddress]);

    const claimedHashes = new Set(claimedResult.rows.map(r => r.transaction_hash));

    // 3. Diff: unclaimed transactions. Rate: 10 $OP per $1 pathUSD (6 decimals) → price * 10^13.
    let totalUnclaimedOPWei = BigInt(0);
    let unclaimedPurchasesCount = 0;

    for (const sale of salesResult.rows) {
      if (!claimedHashes.has(sale.transaction_hash)) {
        const opWei = BigInt(sale.price) * BigInt(10**13);
        totalUnclaimedOPWei += opWei;
        unclaimedPurchasesCount++;
      }
    }

    // 4. Unclaimed fishing rewards. Stored as wei throughout — no multiplication here.
    const fishingRewardsResult = await db.query(`
      SELECT COALESCE(SUM(points_awarded), 0)::numeric as total
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'fish' AND claimed = FALSE
    `, [cleanAddress]);

    const unclaimedFishingOPWei = BigInt(fishingRewardsResult.rows[0]?.total || 0);

    // 5. On-chain nonces
    let tradingNonce = BigInt(0);
    let fishingNonce = BigInt(0);

    if (env.rewardsClaimer) {
      try {
        const client = makeClient();
        [tradingNonce, fishingNonce] = await Promise.all([
          client.readContract({
            address: env.rewardsClaimer as Address,
            abi,
            functionName: 'tradingNonces',
            args: [cleanAddress as Address]
          }),
          client.readContract({
            address: env.rewardsClaimer as Address,
            abi,
            functionName: 'fishingNonces',
            args: [cleanAddress as Address]
          })
        ]);
      } catch (e) {
        console.warn('Error fetching nonces from contract:', e);
      }
    }

    res.status(200).json({
      trading: {
        totalPurchases,
        unclaimedPurchases: unclaimedPurchasesCount,
        unclaimedOP: totalUnclaimedOPWei.toString(),
        unclaimedFormatted: (Number(totalUnclaimedOPWei) / 1e18).toFixed(2)
      },
      fishing: {
        unclaimedOP: unclaimedFishingOPWei.toString(),
        unclaimedFormatted: (Number(unclaimedFishingOPWei) / 1e18).toFixed(2)
      },
      nonces: {
        trading: Number(tradingNonce),
        fishing: Number(fishingNonce)
      }
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
