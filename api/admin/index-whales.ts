import { getPool } from '../_db.js';
import { createPublicClient, http } from 'viem';
// Defined as a custom chain-like setup for Tempo
const tempoTransport = http(process.env.RPC_URL || 'https://rpc.tempo.xyz');

import type { VercelRequest, VercelResponse } from '@vercel/node';

const ABI = [{ name: 'tokenURI', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }] }] as const;
const CONTRACT = (process.env.NFT_CONTRACT || '0x1065ef5996C86C8C90D97974F3c9E5234416839F') as `0x${string}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { secret } = req.query;
  // Simple guard for indexing operation
  if (secret !== 'whales-2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = await getPool();
    
    // Initialize catch table
    await db.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        token_id INT PRIMARY KEY,
        metadata JSONB NOT NULL,
        indexed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const client = createPublicClient({ 
      transport: tempoTransport
    });

    const totalWhales = 3333;
    const batchSize = 25;
    let indexed = 0;

    // Use query param for partial indexing to avoid timeouts
    const startId = parseInt(req.query.start as string || '0');
    const limit = parseInt(req.query.limit as string || '500');
    const endId = Math.min(startId + limit, totalWhales);

    console.log(`Starting indexing from ${startId} to ${endId}...`);

    for (let i = startId; i < endId; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, endId);
      const batchIds = Array.from({ length: batchEnd - i }, (_, k) => i + k);

      const results = await Promise.all(
        batchIds.map(async (id) => {
          try {
            const uri = await client.readContract({
              address: CONTRACT,
              abi: ABI,
              functionName: 'tokenURI',
              args: [BigInt(id)]
            });

            const base64 = (uri as string).replace('data:application/json;base64,', '');
            const metadataDecoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

            return { id, metadata: metadataDecoded };
          } catch (e) {
            console.error(`Failed ID ${id}:`, e);
            return null;
          }
        })
      );

      // Bulk upsert would be faster but for 25 items individual queries are fine in this one-off script
      for (const item of results) {
        if (!item) continue;
        await db.query(
          'INSERT INTO tokens (token_id, metadata) VALUES ($1, $2) ON CONFLICT (token_id) DO UPDATE SET metadata = $2',
          [item.id, item.metadata]
        );
      }
      
      indexed += results.filter(Boolean).length;
    }

    res.status(200).json({ 
      success: true, 
      indexed, 
      nextStart: endId < totalWhales ? endId : null 
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
