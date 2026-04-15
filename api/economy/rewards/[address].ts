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

    // 1. All sales for this buyer
    const salesResult = await db.query(`
      SELECT transaction_hash, price::numeric as price
      FROM sales
      WHERE LOWER(buyer) = $1
    `, [cleanAddress]);

    // 2. Purchase events already tracked (pending or confirmed, both count — prevents double-signing)
    const existingPurchasesResult = await db.query(`
      SELECT transaction_hash
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'purchase'
    `, [cleanAddress]);

    const trackedHashes = new Set(existingPurchasesResult.rows.map(r => r.transaction_hash));

    // 3. Diff: unclaimed sales. Rate: 10 $OP per $1 pathUSD. pathUSD has 6 decimals, $OP has 18.
    //    Stored in points_awarded as wei: opWei = price * 10 * 10^12 = price * 10^13.
    let totalUnclaimedOPWei = BigInt(0);
    let unclaimedSalesCount = 0;

    for (const sale of salesResult.rows) {
      if (!trackedHashes.has(sale.transaction_hash)) {
        const opWei = BigInt(sale.price) * BigInt(10**13);
        totalUnclaimedOPWei += opWei;
        unclaimedSalesCount++;
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
        totalPurchases: salesResult.rows.length,
        unclaimedPurchases: unclaimedSalesCount,
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
