import { getPool } from '../_db.js';
import { createPublicClient, http, Address, parseAbi } from 'viem';
import { getEnvConfig } from '../_env.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const erc20Abi = parseAbi([
  'function transfer(address, uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
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

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { address, txHash } = req.body;
    if (!address || !txHash) {
      res.status(400).json({ error: 'Missing address or txHash' });
      return;
    }

    const env = getEnvConfig();
    const treasury = env.requireTreasuryWallet().toLowerCase();
    const pointsContract = env.requirePointsContract().toLowerCase();

    const cleanAddress = address.toLowerCase();
    const db = await getPool();

    // 1. Already bought within 24 hours?
    const existing = await db.query(`
      SELECT id FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'tackle_box' AND created_at >= NOW() - INTERVAL '24 hours'
    `, [cleanAddress]);

    if (existing.rows.length > 0) {
      res.status(400).json({ error: 'Tackle box already purchased within the last 24 hours' });
      return;
    }

    // 2. Reject reuse of the same tx
    const usedTx = await db.query(`
      SELECT id FROM game_events
      WHERE result->>'txHash' = $1
    `, [txHash]);

    if (usedTx.rows.length > 0) {
      res.status(400).json({ error: 'Transaction already used' });
      return;
    }

    // 3. Verify the on-chain transfer
    const client = makeClient();
    const receipt = await client.waitForTransactionReceipt({ hash: txHash as `0x${string}` });

    const transferLogs = receipt.logs.filter(log =>
      log.address.toLowerCase() === pointsContract
    );

    let validTransfer = false;
    for (const log of transferLogs) {
      if (log.topics[0] !== TRANSFER_TOPIC) continue;
      try {
        const from = '0x' + log.topics[1]?.slice(26).toLowerCase();
        const to = '0x' + log.topics[2]?.slice(26).toLowerCase();
        const value = BigInt(log.data);
        if (from === cleanAddress && to === treasury && value === BigInt(125) * BigInt(10**18)) {
          validTransfer = true;
          break;
        }
      } catch (e) {
        console.warn('Error parsing log:', e);
      }
    }

    if (!validTransfer) {
      res.status(400).json({ error: 'Valid $OP transfer not found in transaction' });
      return;
    }

    // 4. Record
    await db.query(`
      INSERT INTO game_events (wallet, game, result, points_earned)
      VALUES ($1, 'tackle_box', $2, 0)
    `, [cleanAddress, JSON.stringify({ txHash, cost: 100, castsGranted: 10 })]);

    res.status(200).json({ success: true, castsGranted: 10 });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
