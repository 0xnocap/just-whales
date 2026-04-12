import pkg from 'pg';
const { Pool } = pkg;
import { createPublicClient, http } from 'viem';
import 'dotenv/config';

const POSTGRES_URL = process.env.POSTGRES_URL;
const RPC_URL = 'https://rpc.tempo.xyz';
const CONTRACT = '0x1065ef5996C86C8C90D97974F3c9E5234416839F';
const ABI = [{ name: 'tokenURI', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }] }];

async function run() {
  if (!POSTGRES_URL) {
    console.error('POSTGRES_URL is required');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const pool = new Pool({
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log('Initializing table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tokens (
      token_id INT PRIMARY KEY,
      metadata JSONB NOT NULL,
      indexed_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const client = createPublicClient({ 
    transport: http(RPC_URL) 
  });

  const totalWhales = 3333;
  const batchSize = 25;
  let indexed = 0;

  console.log(`Starting index of ${totalWhales} Whales...`);

  for (let i = 0; i < totalWhales; i += batchSize) {
    const end = Math.min(i + batchSize, totalWhales);
    const batchIds = Array.from({ length: end - i }, (_, k) => i + k);

    try {
      const results = await Promise.all(
        batchIds.map(async (id) => {
          try {
            const uri = await client.readContract({
              address: CONTRACT,
              abi: ABI,
              functionName: 'tokenURI',
              args: [BigInt(id)]
            }) as string;

            const base64 = uri.replace('data:application/json;base64,', '');
            const metadata = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

            return { id, metadata };
          } catch (e) {
            console.error(`Error fetching ID ${id}:`, e);
            return null;
          }
        })
      );

      // Save batch
      const client_db = await pool.connect();
      try {
        await client_db.query('BEGIN');
        for (const item of results) {
          if (!item) continue;
          await client_db.query(
            'INSERT INTO tokens (token_id, metadata) VALUES ($1, $2) ON CONFLICT (token_id) DO UPDATE SET metadata = $2',
            [item.id, item.metadata]
          );
        }
        await client_db.query('COMMIT');
      } catch (e) {
        await client_db.query('ROLLBACK');
        console.error('Batch DB error:', e);
      } finally {
        client_db.release();
      }

      indexed += results.filter(Boolean).length;
      process.stdout.write(`\rProgress: ${indexed} / ${totalWhales} (${Math.round((indexed/totalWhales)*100)}%)`);
    } catch (e) {
      console.error('Batch error:', e);
    }
  }

  console.log('\nIndexing complete!');
  await pool.end();
}

run().catch(console.error);
