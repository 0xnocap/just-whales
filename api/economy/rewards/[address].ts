import { getPool } from '../../_db.js';
import { createPublicClient, http, Address, parseAbi } from 'viem';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const REWARDS_CLAIMER_CONTRACT = process.env.REWARDS_CLAIMER_CONTRACT as Address;
const TEMPO_RPC = 'https://rpc.tempo.xyz';

const publicClient = createPublicClient({
  chain: {
    id: 4217,
    name: 'Tempo',
    nativeCurrency: { name: 'Tempo', symbol: 'TMP', decimals: 18 },
    rpcUrls: { default: { http: [TEMPO_RPC] } }
  },
  transport: http()
});

const abi = parseAbi([
  'function tradingNonces(address) view returns (uint256)',
  'function fishingNonces(address) view returns (uint256)'
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { address } = req.query;
    if (!address || typeof address !== 'string') {
      res.status(400).json({ error: 'Missing or invalid address parameter' });
      return;
    }

    const cleanAddress = address.toLowerCase();
    const db = await getPool();

    // 1. Get all sales for this buyer from Goldsky table
    const salesResult = await db.query(`
      SELECT transaction_hash, price::numeric as price
      FROM sales
      WHERE LOWER(buyer) = $1
    `, [cleanAddress]);

    // 2. Get all purchase events from economy_events table (pending OR confirmed)
    //    Once a sale is recorded in economy_events (even as pending), it's accounted for.
    //    This prevents double-signing.
    const claimedSalesResult = await db.query(`
      SELECT transaction_hash, claimed
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'purchase'
    `, [cleanAddress]);

    const claimedHashes = new Set(claimedSalesResult.rows.map(r => r.transaction_hash));
    
    // 3. Diff: unclaimed sales
    let totalUnclaimedOP = BigInt(0);
    let unclaimedSalesCount = 0;

    for (const sale of salesResult.rows) {
      if (!claimedHashes.has(sale.transaction_hash)) {
        // Rate: 10 $OP per $1 pathUSD
        // price is in 6 decimals. $OP is 18 decimals.
        // OP_wei = (price / 1e6) * 10 * 1e18 = price * 10^13
        const opWei = BigInt(sale.price) * BigInt(10**13);
        totalUnclaimedOP += opWei;
        unclaimedSalesCount++;
      }
    }

    // 4. Get unclaimed fishing rewards from economy_events
    //    points_awarded is stored as human-readable $OP (e.g. 50, 2500).
    //    Convert to wei by multiplying by 10^18 here.
    const fishingRewardsResult = await db.query(`
      SELECT SUM(points_awarded)::numeric as total
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'fish' AND claimed = FALSE
    `, [cleanAddress]);

    const unclaimedFishingPlain = BigInt(fishingRewardsResult.rows[0]?.total || 0);
    const unclaimedFishingOP = unclaimedFishingPlain * BigInt(10**18);

    // 5. Get on-chain nonces
    let tradingNonce = BigInt(0);
    let fishingNonce = BigInt(0);

    if (REWARDS_CLAIMER_CONTRACT) {
      try {
        [tradingNonce, fishingNonce] = await Promise.all([
          publicClient.readContract({
            address: REWARDS_CLAIMER_CONTRACT,
            abi,
            functionName: 'tradingNonces',
            args: [cleanAddress as Address]
          }),
          publicClient.readContract({
            address: REWARDS_CLAIMER_CONTRACT,
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
        unclaimedOP: totalUnclaimedOP.toString(),
        unclaimedFormatted: (Number(totalUnclaimedOP) / 1e18).toFixed(2)
      },
      fishing: {
        unclaimedOP: unclaimedFishingOP.toString(),
        unclaimedFormatted: Number(unclaimedFishingPlain).toFixed(2)
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
