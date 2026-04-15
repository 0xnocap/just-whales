import { getPool } from '../_db.js';
import { createPublicClient, http, Address, parseAbi } from 'viem';
import { signFishingClaim } from '../_signer.js';
import { getEnvConfig } from '../_env.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const abi = parseAbi([
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

    // 1. Sum unclaimed fishing rewards. points_awarded stored as wei everywhere.
    const unclaimedResult = await db.query(`
      SELECT COALESCE(SUM(points_awarded), 0)::numeric as total
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'fish' AND claimed = FALSE
    `, [cleanAddress]);

    const totalUnclaimedOPWei = BigInt(unclaimedResult.rows[0]?.total || 0);

    if (totalUnclaimedOPWei === BigInt(0)) {
      res.status(400).json({ error: 'No unclaimed fishing rewards' });
      return;
    }

    // 2. Read current fishing nonce from contract
    const client = makeClient();
    const fishingNonce = await client.readContract({
      address: claimer as Address,
      abi,
      functionName: 'fishingNonces',
      args: [cleanAddress as Address]
    });

    // 3. Sign EIP-712 claim
    const signature = await signFishingClaim(cleanAddress as Address, totalUnclaimedOPWei, fishingNonce);

    // 4. Do NOT mark as claimed here. Frontend calls /api/economy/confirm-claim
    //    after the on-chain tx succeeds to prevent lost rewards on failed txs.

    res.status(200).json({
      amount: totalUnclaimedOPWei.toString(),
      nonce: Number(fishingNonce),
      signature
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
