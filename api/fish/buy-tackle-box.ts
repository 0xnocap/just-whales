import { getPool } from '../_db.js';
import { createPublicClient, http, Address, parseAbi, parseEventLogs } from 'viem';
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

    const expectedValue = BigInt(125) * BigInt(10**18);
    
    // Use viem's parseEventLogs to handle padding and address normalization automatically
    const logs = parseEventLogs({
      abi: erc20Abi,
      logs: receipt.logs,
      eventName: 'Transfer',
    });

    let validTransfer = false;
    const seen: any[] = [];

    for (const log of logs) {
      // parseEventLogs ensures from/to are normalized addresses
      const { from, to, value } = log.args;
      const logTokenAddress = log.address.toLowerCase();

      seen.push({ from, to, value: value.toString(), token: logTokenAddress });

      if (
        logTokenAddress === pointsContract &&
        from.toLowerCase() === cleanAddress &&
        to.toLowerCase() === treasury &&
        value === expectedValue
      ) {
        validTransfer = true;
        break;
      }
    }

    if (!validTransfer) {
      console.error('[buy-tackle-box] Verification failed', {
        txHash,
        expected: { from: cleanAddress, to: treasury, value: expectedValue.toString(), token: pointsContract },
        seenTransfers: seen,
      });
      res.status(400).json({ 
        error: 'Valid $OP transfer not found in transaction',
        debug: {
          expected: { from: cleanAddress, to: treasury, value: expectedValue.toString(), token: pointsContract },
          seenTransfers: seen
        }
      });
      return;
    }

    // 4. Record
    await db.query(`
      INSERT INTO game_events (wallet, game, result, points_earned)
      VALUES ($1, 'tackle_box', $2, 0)
    `, [cleanAddress, JSON.stringify({ txHash, cost: 125, castsGranted: 10 })]);

    res.status(200).json({ success: true, castsGranted: 10 });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
