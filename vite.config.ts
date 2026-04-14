import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import type { ViteDevServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env.example') });
// Also try .env if it exists
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

function apiMiddleware() {
  return {
    name: 'api-middleware',
    configureServer(server: ViteDevServer) {
      let pool: any = null;
      const getPool = async () => {
        if (pool) return pool;
        const { Pool } = await import('pg');
        pool = new Pool({
          connectionString: process.env.POSTGRES_URL,
          ssl: { rejectUnauthorized: false },
        });
        return pool;
      };

      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        try {
          const db = await getPool();
          // --- /api/collection/stats ---
          if (req.url === '/api/collection/stats') {
            res.setHeader('Content-Type', 'application/json');
            const [holdersResult, mintedResult, transfersResult, volResult] = await Promise.all([
              db.query(`
                SELECT COUNT(DISTINCT owner) as holders FROM (
                  SELECT DISTINCT ON (token_id) "to" as owner
                  FROM transfers
                  ORDER BY token_id, block_number DESC, vid DESC
                ) sub
                WHERE owner != '0x0000000000000000000000000000000000000000'
              `),
              db.query(`SELECT COUNT(*) as minted FROM transfers WHERE "from" = '0x0000000000000000000000000000000000000000'`),
              db.query(`SELECT COUNT(*) as total FROM transfers WHERE "from" != '0x0000000000000000000000000000000000000000'`),
              db.query(`
                SELECT 
                  SUM(price::numeric) as total_vol,
                  SUM(CASE WHEN timestamp::bigint > $1 THEN price::numeric ELSE 0 END) as vol_24h
                FROM sales
              `, [Math.floor(Date.now() / 1000) - 86400]),
            ]);
            res.end(JSON.stringify({
              holders: Number(holdersResult.rows[0].holders),
              totalMinted: Number(mintedResult.rows[0].minted),
              totalTransfers: Number(transfersResult.rows[0].total),
              totalVolume: Number(volResult.rows[0].total_vol || 0) / 1e6,
              volume24h: Number(volResult.rows[0].vol_24h || 0) / 1e6,
            }));
            return;
          }

          // --- /api/collection/listings ---
          if (req.url === '/api/collection/listings' || req.url.startsWith('/api/collection/listings?')) {
            res.setHeader('Content-Type', 'application/json');
            const sellerParam = req.url.match(/[?&]seller=([^&]+)/)?.[1]?.toLowerCase() || null;
            const result = await db.query(`
              WITH latest_listings AS (
                SELECT DISTINCT ON (l.token_id)
                  l.listing_id, l.seller, l.nft_contract,
                  l.token_id::int as token_id,
                  l.price::numeric as price,
                  l.expires_at::numeric as expires_at,
                  l.transaction_hash,
                  l.timestamp::bigint as timestamp,
                  t.metadata
                FROM listed l
                LEFT JOIN tokens t ON l.token_id::numeric = t.token_id::numeric
                ORDER BY l.token_id, l.timestamp DESC
              )
              SELECT * FROM latest_listings
              WHERE listing_id NOT IN (SELECT listing_id FROM sales)
                AND listing_id NOT IN (SELECT listing_id FROM canceled)
                ${sellerParam ? 'AND LOWER(seller) = $1' : ''}
              ORDER BY price ASC
            `, sellerParam ? [sellerParam] : []);
            res.end(JSON.stringify(result.rows));
            return;
          }

          // --- /api/collection/metadata ---
          const metadataMatch = req.url.match(/^\/api\/collection\/metadata\?ids=(.*)$/);
          if (metadataMatch) {
            res.setHeader('Content-Type', 'application/json');
            const ids = metadataMatch[1].split(',').map((id: string) => parseInt(id)).filter((id: number) => !isNaN(id));
            const result = await db.query('SELECT token_id, metadata FROM tokens WHERE token_id = ANY($1)', [ids]);
            const map: Record<number, any> = {};
            result.rows.forEach((r: any) => { map[r.token_id] = r.metadata; });
            res.end(JSON.stringify(map));
            return;
          }

          // --- /api/owners ---
          if (req.url === '/api/owners') {
            res.setHeader('Content-Type', 'application/json');
            const result = await db.query(`
              SELECT token_id::int as token_id, "to" as owner
              FROM (
                SELECT DISTINCT ON (token_id) token_id, "to"
                FROM transfers
                ORDER BY token_id, block_number DESC, vid DESC
              ) sub
              WHERE "to" != '0x0000000000000000000000000000000000000000'
              ORDER BY token_id
            `);
            // Return as a map: { tokenId: ownerAddress }
            const ownerMap: Record<string, string> = {};
            result.rows.forEach((r: any) => { ownerMap[r.token_id] = r.owner; });
            res.end(JSON.stringify(ownerMap));
            return;
          }

          // --- /api/profile/:address ---
          const profileMatch = req.url.match(/^\/api\/profile\/([a-fA-F0-9x]+)$/);
          if (profileMatch) {
            res.setHeader('Content-Type', 'application/json');
            const address = profileMatch[1].toLowerCase();
            const result = await db.query(`
              SELECT token_id::int as token_id
              FROM (
                SELECT DISTINCT ON (token_id) token_id, "to" as owner
                FROM transfers
                ORDER BY token_id, block_number DESC, vid DESC
              ) sub
              WHERE LOWER(owner) = $1
              ORDER BY token_id
            `, [address]);
            
            // Activity for this address
            const activity = await db.query(`
              SELECT token_id::int as token_id, "from", "to", transaction_hash, timestamp::bigint as timestamp, block_number::bigint as block_number
              FROM transfers
              WHERE LOWER("from") = $1 OR LOWER("to") = $1
              ORDER BY block_number DESC
              LIMIT 50
            `, [address]);

            res.end(JSON.stringify({
              address,
              ownedTokenIds: result.rows.map((r: any) => r.token_id),
              activity: activity.rows,
            }));
            return;
          }

          // --- /api/token/:tokenId/history ---
          const tokenMatch = req.url.match(/^\/api\/token\/(\d+)\/history$/);
          if (tokenMatch) {
            res.setHeader('Content-Type', 'application/json');
            const tokenId = parseInt(tokenMatch[1]);
            const result = await db.query(`
              SELECT "from", "to", transaction_hash, timestamp::bigint as timestamp, block_number::bigint as block_number
              FROM transfers
              WHERE token_id = $1
              ORDER BY block_number DESC, vid DESC
            `, [tokenId]);
            res.end(JSON.stringify(result.rows));
            return;
          }

          // --- /api/activity ---
          if (req.url === '/api/activity') {
            res.setHeader('Content-Type', 'application/json');
            const result = await db.query(`
              SELECT a.*, tok.metadata->>'image_data' as image_data
              FROM (
                SELECT 'transfer' as type, token_id::int as token_id, "from"::text, "to"::text, NULL::numeric as price, transaction_hash::text, timestamp::bigint as timestamp, block_number::bigint as block_number
                FROM transfers WHERE "from" != '0x0000000000000000000000000000000000000000'
                UNION ALL
                SELECT 'sale' as type, token_id::int as token_id, seller::text as "from", buyer::text as "to", price::numeric as price, transaction_hash::text, timestamp::bigint as timestamp, block_number::bigint as block_number
                FROM sales
                UNION ALL
                SELECT 'list' as type, token_id::int as token_id, seller::text as "from", NULL::text as "to", price::numeric as price, transaction_hash::text, timestamp::bigint as timestamp, block_number::bigint as block_number
                FROM listed
                UNION ALL
                SELECT 'cancel' as type, l.token_id::int as token_id, l.seller::text as "from", NULL::text as "to", NULL::numeric as price, c.transaction_hash::text, c.timestamp::bigint as timestamp, c.block_number::bigint as block_number
                FROM canceled c LEFT JOIN listed l ON c.listing_id::numeric = l.listing_id::numeric
                ORDER BY block_number DESC
                LIMIT 100
              ) a
              LEFT JOIN tokens tok ON a.token_id = tok.token_id::int
            `);
            res.end(JSON.stringify(result.rows));
            return;
          }

          // --- /api/debug_db ---
          if (req.url === '/api/debug_db') {
            res.setHeader('Content-Type', 'application/json');
            const [tokenCount, listedCount, tokensSample, listingsSample] = await Promise.all([
              db.query('SELECT COUNT(*) as count FROM tokens'),
              db.query('SELECT COUNT(*) as count FROM listed'),
              db.query('SELECT * FROM tokens LIMIT 3'),
              db.query('SELECT * FROM listed LIMIT 3')
            ]);
            res.end(JSON.stringify({
              summary: {
                tokensInDb: Number(tokenCount.rows[0].count),
                listingsInDb: Number(listedCount.rows[0].count)
              },
              tokensSample: tokensSample.rows,
              listingsSample: listingsSample.rows,
              schemaCheck: {
                tokens: (await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tokens'`)).rows,
                listed: (await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'listed'`)).rows
              }
            }));
            return;
          }

          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Not found' }));
        } catch (err: any) {
          console.error('API error:', err);
          res.statusCode = 500;
          try { res.setHeader('Content-Type', 'application/json'); } catch(e) {}
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), apiMiddleware()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.ALCHEMY_TEMPO_RPC': JSON.stringify(env.ALCHEMY_TEMPO_RPC || ''),
      'process.env.ALCHEMY_TEMPO_WEBSOCKET': JSON.stringify(env.ALCHEMY__TEMPO_WEBSOCKET || ''),
      'process.env.NFT_CONTRACT': JSON.stringify(mode === 'development' ? env.TEST_NFT_CONTRACT : env.NFT_CONTRACT),
      'process.env.MARKETPLACE_CONTRACT': JSON.stringify(mode === 'development' ? env.TEST_MARKETPLACE_CONTRACT : env.MARKETPLACE_CONTRACT),
      'process.env.PATH_USD_CONTRACT': JSON.stringify(mode === 'development' ? env.TEST_PATH_USD_CONTRACT : env.PATH_USD_CONTRACT),
      'process.env.POINTS_CONTRACT': JSON.stringify(mode === 'development' ? env.TEST_POINTS_CONTRACT : env.POINTS_CONTRACT),
      'process.env.STAKING_CONTRACT': JSON.stringify(mode === 'development' ? env.TEST_STAKING_CONTRACT : env.STAKING_CONTRACT),
      'process.env.RPC_URL': JSON.stringify(mode === 'development' ? env.TEST_RPC_URL : env.RPC_URL),
      'process.env.CHAIN_ID': JSON.stringify(env.CHAIN_ID || (mode === 'development' ? '42431' : '4217')),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
