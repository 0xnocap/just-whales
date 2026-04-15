import { getPool } from '../_db.js';
import { createPublicClient, http, Address, parseAbi } from 'viem';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const TREASURY_WALLET = process.env.TREASURY_WALLET as Address;
const POINTS_CONTRACT = process.env.POINTS_CONTRACT as Address || '0xCf4A2079A2c058d266A0999F3fCA256d6F1F53a9';
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

const erc20Abi = parseAbi([
  'function transfer(address, uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
]);

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

    const cleanAddress = address.toLowerCase();
    const db = await getPool();
    const today = new Date().toISOString().split('T')[0];

    // 1. Check if already bought today
    const existing = await db.query(`
      SELECT id FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'tackle_box' AND created_at >= $2
    `, [cleanAddress, today]);

    if (existing.rows.length > 0) {
      res.status(400).json({ error: 'Already purchased tackle box today' });
      return;
    }

    // 2. Verify on-chain transfer
    // A more robust check would also ensure the tx hasn't been used before.
    const usedTx = await db.query(`
      SELECT id FROM game_events
      WHERE result->>'txHash' = $1
    `, [txHash]);

    if (usedTx.rows.length > 0) {
      res.status(400).json({ error: 'Transaction already used' });
      return;
    }

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
    
    // Check if the tx is to the Points contract and calls transfer to treasury
    // Actually, we can just check the logs for a Transfer(user, treasury, 100e18)
    const transferLogs = receipt.logs.filter(log => 
      log.address.toLowerCase() === POINTS_CONTRACT.toLowerCase()
    );

    let validTransfer = false;
    for (const log of transferLogs) {
      try {
        // Decode log manually or use parseEventLogs if available
        // Simple check: Transfer event has 3 topics (hash, from, to)
        // Topic 0: keccak256("Transfer(address,address,uint256)")
        const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        if (log.topics[0] === transferTopic) {
          const from = '0x' + log.topics[1]?.slice(26).toLowerCase();
          const to = '0x' + log.topics[2]?.slice(26).toLowerCase();
          const value = BigInt(log.data);
          
          if (from === cleanAddress && to === TREASURY_WALLET.toLowerCase() && value === BigInt(100) * BigInt(10**18)) {
            validTransfer = true;
            break;
          }
        }
      } catch (e) {
        console.warn('Error parsing log:', e);
      }
    }

    if (!validTransfer) {
      res.status(400).json({ error: 'Valid $OP transfer not found in transaction' });
      return;
    }

    // 3. Record in game_events
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
