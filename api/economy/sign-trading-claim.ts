import { getPool } from '../_db.js';
import { createPublicClient, http, Address, parseAbi } from 'viem';
import { signTradingClaim } from '../_signer.js';
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
  'function tradingNonces(address) view returns (uint256)'
]);

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

    // 1. Calculate unclaimed trading $OP
    const salesResult = await db.query(`
      SELECT transaction_hash, price::numeric as price
      FROM sales
      WHERE LOWER(buyer) = $1
    `, [cleanAddress]);

    const claimedSalesResult = await db.query(`
      SELECT transaction_hash
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'purchase'
    `, [cleanAddress]);

    const claimedHashes = new Set(claimedSalesResult.rows.map(r => r.transaction_hash));
    
    let totalUnclaimedOP = BigInt(0);
    const unclaimedSales = [];

    for (const sale of salesResult.rows) {
      if (!claimedHashes.has(sale.transaction_hash)) {
        const opWei = BigInt(sale.price) * BigInt(10**13);
        totalUnclaimedOP += opWei;
        unclaimedSales.push({ hash: sale.transaction_hash, amount: opWei });
      }
    }

    if (totalUnclaimedOP === BigInt(0)) {
      res.status(400).json({ error: 'No unclaimed rewards' });
      return;
    }

    // 2. Read current trading nonce from contract
    const tradingNonce = await publicClient.readContract({
      address: REWARDS_CLAIMER_CONTRACT,
      abi,
      functionName: 'tradingNonces',
      args: [cleanAddress as Address]
    });

    // 3. Sign EIP-712 claim
    const signature = await signTradingClaim(cleanAddress as Address, totalUnclaimedOP, tradingNonce);

    // 4. Record in economy_events and update user balance
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      for (const sale of unclaimedSales) {
        await client.query(`
          INSERT INTO economy_events (wallet, event_type, transaction_hash, points_awarded, claimed)
          VALUES ($1, 'purchase', $2, $3, FALSE)
          ON CONFLICT DO NOTHING
        `, [cleanAddress, sale.hash, sale.amount.toString()]);
      }

      await client.query(`
        INSERT INTO users (wallet, points_balance, lifetime_points)
        VALUES ($1, 0, 0)
        ON CONFLICT (wallet) DO UPDATE SET updated_at = NOW()
      `, [cleanAddress]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.status(200).json({
      amount: totalUnclaimedOP.toString(),
      nonce: Number(tradingNonce),
      signature,
      salesClaimed: unclaimedSales.length
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
