import { getPool } from '../_db.js';
import { createPublicClient, http, Address, parseAbi } from 'viem';
import { signFishingClaim } from '../_signer.js';
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
  'function fishingNonces(address) view returns (uint256)'
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

    // 1. Sum unclaimed fishing rewards
    //    points_awarded stored as plain integers (e.g. 50, 2500).
    //    Convert to wei (x 10^18) only at sign time, as the contract expects wei.
    const unclaimedResult = await db.query(`
      SELECT SUM(points_awarded)::numeric as total, ARRAY_AGG(id) as ids
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'fish' AND claimed = FALSE
    `, [cleanAddress]);

    const totalUnclaimedPlain = BigInt(unclaimedResult.rows[0]?.total || 0);
    const totalUnclaimedOPWei = totalUnclaimedPlain * BigInt(10**18);
    const eventIds = unclaimedResult.rows[0]?.ids || [];

    if (totalUnclaimedPlain === BigInt(0)) {
      res.status(400).json({ error: 'No unclaimed fishing rewards' });
      return;
    }

    // 2. Read current fishing nonce from contract
    const fishingNonce = await publicClient.readContract({
      address: REWARDS_CLAIMER_CONTRACT,
      abi,
      functionName: 'fishingNonces',
      args: [cleanAddress as Address]
    });

    // 3. Sign EIP-712 claim
    const signature = await signFishingClaim(cleanAddress as Address, totalUnclaimedOPWei, fishingNonce);

    // 4. Do NOT mark as claimed here. Frontend calls /api/economy/confirm-claim
    //    after the on-chain tx succeeds. This prevents lost rewards on failed txs.

    res.status(200).json({
      amount: totalUnclaimedOPWei.toString(),
      nonce: Number(fishingNonce),
      signature,
      eventsPending: eventIds.length
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
