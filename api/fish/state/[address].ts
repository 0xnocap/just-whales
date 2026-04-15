import { getPool } from '../../_db.js';
import { FREE_DAILY_ATTEMPTS, TACKLE_BOX_ATTEMPTS } from '../_gameData.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createPublicClient, http, parseAbi } from 'viem';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { address } = req.query;
    if (!address || typeof address !== 'string') {
      res.status(400).json({ error: 'Missing or invalid address parameter' });
      return;
    }

    const cleanAddress = address.toLowerCase();
    const db = await getPool();
    const today = new Date().toISOString().split('T')[0];

    // --- NFT Ownership Check ---
    let isNFTOwner = false;
    
    // 1. Unstaked Check (DB)
    const ownershipResult = await db.query(`
      SELECT COUNT(*)::int as count FROM (
        SELECT DISTINCT ON (token_id) "to" as owner FROM transfers ORDER BY token_id, block_number DESC, vid DESC
      ) sub WHERE LOWER(owner) = $1
    `, [cleanAddress]);
    
    if (ownershipResult.rows[0].count > 0) {
      isNFTOwner = true;
    } else {
      // 2. Staked Check (On-Chain Fallback)
      try {
        const isProd = process.env.ENVIRONMENT === 'production';
        const chainId = Number((isProd ? process.env.CHAIN_ID : process.env.TEST_CHAIN_ID) || (isProd ? '4217' : '42431'));
        const rpcUrl = (isProd ? process.env.RPC_URL : process.env.TEST_RPC_URL) || (isProd ? 'https://rpc.tempo.xyz' : 'https://rpc.moderato.tempo.xyz');
        const stakingContract = isProd ? process.env.STAKING_CONTRACT : process.env.TEST_STAKING_CONTRACT;
        
        if (stakingContract) {
          const publicClient = createPublicClient({
            chain: { id: chainId, name: 'Tempo', nativeCurrency: { name: 'TMP', symbol: 'TMP', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } },
            transport: http()
          });
          const abi = parseAbi(['function stakedTokensOf(address) view returns (uint256[])']);
          const stakedTokens = await publicClient.readContract({
            address: stakingContract as `0x${string}`,
            abi,
            functionName: 'stakedTokensOf',
            args: [cleanAddress as `0x${string}`]
          }) as readonly bigint[];
          
          if (stakedTokens && stakedTokens.length > 0) {
            isNFTOwner = true;
          }
        }
      } catch (err) {
        console.error('Error verifying staked ownership:', err);
      }
    }
    // ----------------------------

    // 1. Casts & Tackle Box status
    const attemptsResult = await db.query(`
      SELECT COUNT(*)::int as count
      FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'fish' AND created_at >= $2
    `, [cleanAddress, today]);

    const tackleBoxResult = await db.query(`
      SELECT created_at
      FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'tackle_box' AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 1
    `, [cleanAddress]);

    const hasTackleBox = tackleBoxResult.rows.length > 0;
    const tackleBoxPurchasedAt = hasTackleBox ? tackleBoxResult.rows[0].created_at : null;
    const totalAllowed = FREE_DAILY_ATTEMPTS + (hasTackleBox ? TACKLE_BOX_ATTEMPTS : 0);
    const usedAttempts = attemptsResult.rows[0].count;

    // 2. Inventory (today's unclaimed/unredeemed catches)
    const inventoryResult = await db.query(`
      SELECT id, result, redeemed, prize_tier
      FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'fish' AND created_at >= $2
        AND (result::jsonb->>'id') IS NOT NULL
      ORDER BY created_at DESC
    `, [cleanAddress, today]);

    // 3. Discovered Fish IDs (lifetime)
    const journalResult = await db.query(`
      SELECT DISTINCT (result->>'id') as fish_id
      FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'fish'
    `, [cleanAddress]);

    // 4. Unclaimed fishing $OP (wei, from economy_events)
    const unclaimedResult = await db.query(`
      SELECT COALESCE(SUM(points_awarded), 0)::numeric as total
      FROM economy_events
      WHERE LOWER(wallet) = $1 AND event_type = 'fish' AND claimed = FALSE
    `, [cleanAddress]);

    const unclaimedWei = BigInt(unclaimedResult.rows[0]?.total || 0);

    res.status(200).json({
      isNFTOwner,
      castsRemaining: Math.max(0, totalAllowed - usedAttempts),
      totalCasts: totalAllowed,
      tackleBoxPurchased: hasTackleBox,
      tackleBoxPurchasedAt: tackleBoxPurchasedAt ? new Date(tackleBoxPurchasedAt).toISOString() : null,
      inventory: inventoryResult.rows.map(r => ({
        gameEventId: r.id,
        fish: typeof r.result === 'string' ? JSON.parse(r.result) : r.result,
        redeemed: r.redeemed,
        prizeTier: r.prize_tier
      })),
      discoveredFishIds: journalResult.rows.map(r => r.fish_id),
      unclaimedFishingOP: unclaimedWei.toString(),
      unclaimedFishingFormatted: (Number(unclaimedWei) / 1e18).toFixed(2)
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
