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
        if (!req.url?.startsWith('/api/')) return next();

        const db = await getPool();

        res.setHeader('Content-Type', 'application/json');

        try {
          // --- /api/collection/stats ---
          if (req.url === '/api/collection/stats') {
            const [holdersResult, mintedResult, transfersResult] = await Promise.all([
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
            ]);
            res.end(JSON.stringify({
              holders: Number(holdersResult.rows[0].holders),
              totalMinted: Number(mintedResult.rows[0].minted),
              totalTransfers: Number(transfersResult.rows[0].total),
            }));
            return;
          }

          // --- /api/owners ---
          if (req.url === '/api/owners') {
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
            const tokenId = parseInt(tokenMatch[1]);
            const result = await db.query(`
              SELECT "from", "to", transaction_hash, timestamp::bigint as timestamp, block_number::bigint as block_number
              FROM transfers
              WHERE token_id = $1
              ORDER BY block_number ASC
            `, [tokenId]);
            res.end(JSON.stringify(result.rows));
            return;
          }

          // --- /api/activity ---
          if (req.url === '/api/activity') {
            const result = await db.query(`
              SELECT token_id::int as token_id, "from", "to", transaction_hash, timestamp::bigint as timestamp, block_number::bigint as block_number
              FROM transfers
              ORDER BY block_number DESC
              LIMIT 50
            `);
            res.end(JSON.stringify(result.rows));
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
        } catch (err: any) {
          console.error('API error:', err);
          res.statusCode = 500;
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
