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
        const isLocal = process.env.POSTGRES_URL?.includes('localhost') || process.env.POSTGRES_URL?.includes('127.0.0.1');
        console.log('Connecting to DB:', process.env.POSTGRES_URL?.split('@')[1]);
        pool = new Pool({
          connectionString: process.env.POSTGRES_URL,
          ssl: isLocal ? false : { rejectUnauthorized: false },
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
            const stakingAddr = (process.env.STAKING_CONTRACT || '').toLowerCase();
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
            
            // Activity for this address — all event types, staking/sale-dupes excluded
            const activity = await db.query(`
              SELECT a.*, tok.metadata->>'image_data' as image_data
              FROM (
                SELECT 'mint' as type, token_id::int as token_id, "from"::text, "to"::text, NULL::numeric as price, transaction_hash::text, timestamp::bigint as timestamp, block_number::bigint as block_number
                FROM transfers
                WHERE "from" = '0x0000000000000000000000000000000000000000'
                  AND LOWER("to") = $1
                UNION ALL
                SELECT 'transfer' as type, token_id::int as token_id, "from"::text, "to"::text, NULL::numeric as price, transaction_hash::text, timestamp::bigint as timestamp, block_number::bigint as block_number
                FROM transfers
                WHERE "from" != '0x0000000000000000000000000000000000000000'
                  AND LOWER("to")   != $2
                  AND LOWER("from") != $2
                  AND transaction_hash NOT IN (SELECT transaction_hash FROM sales)
                  AND (LOWER("from") = $1 OR LOWER("to") = $1)
                UNION ALL
                SELECT 'sale' as type, token_id::int, seller::text, buyer::text, price::numeric, transaction_hash::text, timestamp::bigint, block_number::bigint
                FROM sales
                WHERE LOWER(seller) = $1 OR LOWER(buyer) = $1
                UNION ALL
                SELECT 'list' as type, token_id::int, seller::text, NULL::text, price::numeric, transaction_hash::text, timestamp::bigint, block_number::bigint
                FROM listed
                WHERE LOWER(seller) = $1
                UNION ALL
                SELECT 'cancel' as type, l.token_id::int, l.seller::text, NULL::text, NULL::numeric, c.transaction_hash::text, c.timestamp::bigint, c.block_number::bigint
                FROM canceled c LEFT JOIN listed l ON c.listing_id::numeric = l.listing_id::numeric
                WHERE LOWER(l.seller) = $1
                ORDER BY block_number DESC
                LIMIT 50
              ) a
              LEFT JOIN tokens tok ON a.token_id = tok.token_id::int
            `, [address, stakingAddr]);

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
            const stakingAddr = (process.env.STAKING_CONTRACT || '').toLowerCase();
            const result = await db.query(`
              SELECT a.*, tok.metadata->>'image_data' as image_data
              FROM (
                SELECT 'transfer' as type, token_id::int as token_id, "from"::text, "to"::text, NULL::numeric as price, transaction_hash::text, timestamp::bigint as timestamp, block_number::bigint as block_number
                FROM transfers
                WHERE "from" != '0x0000000000000000000000000000000000000000'
                  AND LOWER("to")   != $1
                  AND LOWER("from") != $1
                  AND transaction_hash NOT IN (SELECT transaction_hash FROM sales)
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
            `, [stakingAddr]);
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

          // --- ECONOMY & FISH GAME ---

          // Helper to get body from request
          const getBody = async (req: any) => {
            return new Promise<any>((resolve) => {
              let body = '';
              req.on('data', (chunk: any) => { body += chunk.toString(); });
              req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
            });
          };

          // Env switch: ENVIRONMENT=production → mainnet vars, else → TEST_* vars
          const devEnv = () => {
            const isProd = process.env.ENVIRONMENT === 'production';
            return {
              isProd,
              rpcUrl: (isProd ? process.env.RPC_URL : process.env.TEST_RPC_URL) || (isProd ? 'https://rpc.tempo.xyz' : 'https://rpc.moderato.tempo.xyz'),
              chainId: Number((isProd ? process.env.CHAIN_ID : process.env.TEST_CHAIN_ID) || (isProd ? '4217' : '42431')),
              claimer: (isProd ? process.env.REWARDS_CLAIMER_CONTRACT : process.env.TEST_REWARDS_CLAIMER_CONTRACT),
              chainName: isProd ? 'Tempo' : 'Tempo Testnet',
            };
          };

          // /api/economy/rewards/:address
          const rewardsMatch = req.url.match(/^\/api\/economy\/rewards\/([a-fA-F0-9x]+)$/);
          if (rewardsMatch) {
            res.setHeader('Content-Type', 'application/json');
            const address = rewardsMatch[1].toLowerCase();
            const salesResult = await db.query('SELECT transaction_hash, price::numeric as price FROM sales WHERE LOWER(buyer) = $1', [address]);
            const claimedSalesResult = await db.query('SELECT transaction_hash FROM economy_events WHERE LOWER(wallet) = $1 AND event_type = \'purchase\'', [address]);
            const claimedHashes = new Set(claimedSalesResult.rows.map((r: any) => r.transaction_hash));
            let totalUnclaimedOP = BigInt(0);
            salesResult.rows.forEach((sale: any) => {
              if (!claimedHashes.has(sale.transaction_hash)) {
                totalUnclaimedOP += BigInt(sale.price) * BigInt(10**13);
              }
            });
            const fishingRewardsResult = await db.query('SELECT COALESCE(SUM(points_awarded), 0)::numeric as total FROM economy_events WHERE LOWER(wallet) = $1 AND event_type = \'fish\' AND claimed = FALSE', [address]);
            // points_awarded stored as wei uniformly
            const fishingWei = BigInt(fishingRewardsResult.rows[0]?.total || 0);

            // Read on-chain nonces from the active-environment claimer
            const e = devEnv();
            let tradingNonce = 0;
            let fishingNonce = 0;
            if (e.claimer) {
              try {
                const { createPublicClient, http, parseAbi } = await import('viem');
                const devClient = createPublicClient({
                  chain: { id: e.chainId, name: e.chainName, nativeCurrency: { name: 'TMP', symbol: 'TMP', decimals: 18 }, rpcUrls: { default: { http: [e.rpcUrl] } } },
                  transport: http()
                });
                const devAbi = parseAbi(['function tradingNonces(address) view returns (uint256)', 'function fishingNonces(address) view returns (uint256)']);
                const [tn, fn] = await Promise.all([
                  devClient.readContract({ address: e.claimer as `0x${string}`, abi: devAbi, functionName: 'tradingNonces', args: [address as `0x${string}`] }),
                  devClient.readContract({ address: e.claimer as `0x${string}`, abi: devAbi, functionName: 'fishingNonces', args: [address as `0x${string}`] })
                ]);
                tradingNonce = Number(tn);
                fishingNonce = Number(fn);
              } catch (err) {
                console.warn('Error reading dev nonces:', err);
              }
            }

            res.end(JSON.stringify({
              trading: {
                totalPurchases: salesResult.rows.length,
                unclaimedOP: totalUnclaimedOP.toString(),
                unclaimedFormatted: (Number(totalUnclaimedOP) / 1e18).toFixed(2)
              },
              fishing: {
                unclaimedOP: fishingWei.toString(),
                unclaimedFormatted: (Number(fishingWei) / 1e18).toFixed(2)
              },
              nonces: { trading: tradingNonce, fishing: fishingNonce }
            }));
            return;
          }

          // /api/economy/confirm-claim (POST)
          if (req.url === '/api/economy/confirm-claim' && req.method === 'POST') {
            res.setHeader('Content-Type', 'application/json');
            const { address, type, txHash } = await getBody(req);
            const eventType = type === 'trading' ? 'purchase' : type === 'fishing' ? 'fish' : null;
            if (!eventType) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid type' }));
              return;
            }
            const result = await db.query(
              'UPDATE economy_events SET claimed = TRUE, claim_tx_hash = $3 WHERE LOWER(wallet) = $1 AND event_type = $2 AND claimed = FALSE',
              [(address || '').toLowerCase(), eventType, txHash || null]
            );
            res.end(JSON.stringify({ confirmed: result.rowCount || 0 }));
            return;
          }

          // /api/fish/state/:address
          const fishStateMatch = req.url.match(/^\/api\/fish\/state\/([a-fA-F0-9x]+)$/);
          if (fishStateMatch) {
            res.setHeader('Content-Type', 'application/json');
            const address = fishStateMatch[1].toLowerCase();
            const today = new Date().toISOString().split('T')[0];
            const attemptsResult = await db.query('SELECT COUNT(*)::int as count FROM game_events WHERE LOWER(wallet) = $1 AND game = \'fish\' AND created_at >= $2', [address, today]);
            const tackleBoxResult = await db.query('SELECT COUNT(*)::int as count FROM game_events WHERE LOWER(wallet) = $1 AND game = \'tackle_box\' AND created_at >= $2', [address, today]);
            const hasTackleBox = tackleBoxResult.rows[0].count > 0;
            const inventoryResult = await db.query('SELECT id, result, redeemed, prize_tier FROM game_events WHERE LOWER(wallet) = $1 AND game = \'fish\' AND created_at >= $2 ORDER BY created_at DESC', [address, today]);
            const journalResult = await db.query('SELECT DISTINCT (result->>\'id\') as fish_id FROM game_events WHERE LOWER(wallet) = $1 AND game = \'fish\'', [address]);
            const unclaimedResult = await db.query('SELECT COALESCE(SUM(points_awarded), 0)::numeric as total FROM economy_events WHERE LOWER(wallet) = $1 AND event_type = \'fish\' AND claimed = FALSE', [address]);
            const unclaimedWei = BigInt(unclaimedResult.rows[0]?.total || 0);
            res.end(JSON.stringify({
              castsRemaining: Math.max(0, (hasTackleBox ? 15 : 5) - attemptsResult.rows[0].count),
              totalCasts: hasTackleBox ? 15 : 5,
              tackleBoxPurchased: hasTackleBox,
              inventory: inventoryResult.rows.map((r: any) => ({
                gameEventId: r.id,
                fish: typeof r.result === 'string' ? JSON.parse(r.result) : r.result,
                redeemed: r.redeemed,
                prizeTier: r.prize_tier
              })),
              discoveredFishIds: journalResult.rows.map((r: any) => r.fish_id),
              unclaimedFishingOP: unclaimedWei.toString(),
              unclaimedFishingFormatted: (Number(unclaimedWei) / 1e18).toFixed(2)
            }));
            return;
          }

          // /api/fish/cast (POST)
          if (req.url === '/api/fish/cast' && req.method === 'POST') {
            res.setHeader('Content-Type', 'application/json');
            const { address } = await getBody(req);
            const cleanAddress = (address || '').toLowerCase();
            // Just a mock for dev middleware - full logic is in api/fish/cast.ts
            res.end(JSON.stringify({ result: 'no_bite', message: 'Dev mock: please use production API for full RNG' }));
            return;
          }

          // /api/fish/sell (POST) — real rolling cap + wei insert to mirror api/fish/sell.ts
          if (req.url === '/api/fish/sell' && req.method === 'POST') {
            res.setHeader('Content-Type', 'application/json');
            const { address, gameEventId } = await getBody(req);
            const cleanAddress = (address || '').toLowerCase();
            const ROLLING_CAP_WEI = BigInt(1000) * BigInt(10**18);
            const WEI_PER_OP = BigInt(10**18);

            const eventResult = await db.query('SELECT * FROM game_events WHERE id = $1 AND LOWER(wallet) = $2 AND game = \'fish\' AND redeemed = FALSE', [gameEventId, cleanAddress]);
            if (eventResult.rows.length === 0) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid or already redeemed catch' }));
              return;
            }
            const fishValuePlain = Number(eventResult.rows[0].points_earned);
            const fishValueWei = BigInt(fishValuePlain) * WEI_PER_OP;

            if (fishValuePlain === 0 && eventResult.rows[0].prize_tier) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'NFT prizes cannot be sold for points.' }));
              return;
            }

            const capResult = await db.query('SELECT COALESCE(SUM(points_awarded), 0)::numeric as total FROM economy_events WHERE LOWER(wallet) = $1 AND event_type = \'fish\' AND created_at >= NOW() - INTERVAL \'1 hour\'', [cleanAddress]);
            const accruedWei = BigInt(capResult.rows[0].total || 0);
            const remainingCapWei = ROLLING_CAP_WEI > accruedWei ? ROLLING_CAP_WEI - accruedWei : BigInt(0);
            const awardedWei = fishValueWei < remainingCapWei ? fishValueWei : remainingCapWei;
            const overflowWei = fishValueWei - awardedWei;

            const dbClient = await db.connect();
            try {
              await dbClient.query('BEGIN');
              await dbClient.query('INSERT INTO economy_events (wallet, event_type, source_id, points_awarded, points_overflow, claimed) VALUES ($1, \'fish\', $2, $3, $4, FALSE)', [cleanAddress, gameEventId, awardedWei.toString(), overflowWei.toString()]);
              await dbClient.query('UPDATE game_events SET redeemed = TRUE WHERE id = $1', [gameEventId]);
              await dbClient.query('INSERT INTO users (wallet, points_balance, lifetime_points) VALUES ($1, 0, 0) ON CONFLICT (wallet) DO UPDATE SET updated_at = NOW()', [cleanAddress]);
              await dbClient.query('COMMIT');
            } catch (e) {
              await dbClient.query('ROLLBACK');
              throw e;
            } finally {
              dbClient.release();
            }

            res.end(JSON.stringify({
              sold: true,
              opEarned: Number(awardedWei / WEI_PER_OP),
              overflow: Number(overflowWei / WEI_PER_OP),
              capRemainingOP: Number((remainingCapWei - awardedWei) / WEI_PER_OP)
            }));
            return;
          }

          // /api/fish/buy-tackle-box (POST)
          if (req.url === '/api/fish/buy-tackle-box' && req.method === 'POST') {
            res.setHeader('Content-Type', 'application/json');
            const { address, txHash } = await getBody(req);
            await db.query('INSERT INTO game_events (wallet, game, result, points_earned) VALUES ($1, \'tackle_box\', $2, 0)', [address.toLowerCase(), JSON.stringify({ txHash, dev: true })]);
            res.end(JSON.stringify({ success: true, castsGranted: 10 }));
            return;
          }

          // /api/economy/sign-trading-claim (POST) — real signing against testnet claimer
          if (req.url === '/api/economy/sign-trading-claim' && req.method === 'POST') {
            res.setHeader('Content-Type', 'application/json');
            const { address } = await getBody(req);
            const cleanAddress = (address || '').toLowerCase();

            // Compute unclaimed sales
            const salesResult = await db.query('SELECT transaction_hash, price::numeric as price FROM sales WHERE LOWER(buyer) = $1', [cleanAddress]);
            const trackedResult = await db.query('SELECT transaction_hash FROM economy_events WHERE LOWER(wallet) = $1 AND event_type = \'purchase\'', [cleanAddress]);
            const tracked = new Set(trackedResult.rows.map((r: any) => r.transaction_hash));

            let totalUnclaimedOPWei = BigInt(0);
            const unclaimedSales: { hash: string; amount: bigint }[] = [];
            salesResult.rows.forEach((sale: any) => {
              if (!tracked.has(sale.transaction_hash)) {
                const opWei = BigInt(sale.price) * BigInt(10**13);
                totalUnclaimedOPWei += opWei;
                unclaimedSales.push({ hash: sale.transaction_hash, amount: opWei });
              }
            });

            if (totalUnclaimedOPWei === BigInt(0)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'No unclaimed trading rewards' }));
              return;
            }

            const e = devEnv();
            const PRIV_KEY = process.env.REWARDS_SIGNER_PRIVATE_KEY;

            if (!e.claimer || !PRIV_KEY) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: `Env vars not set (${e.isProd ? 'REWARDS_CLAIMER_CONTRACT' : 'TEST_REWARDS_CLAIMER_CONTRACT'} or REWARDS_SIGNER_PRIVATE_KEY)` }));
              return;
            }

            const { createPublicClient, http, parseAbi } = await import('viem');
            const publicClient = createPublicClient({
              chain: { id: e.chainId, name: e.chainName, nativeCurrency: { name: 'TMP', symbol: 'TMP', decimals: 18 }, rpcUrls: { default: { http: [e.rpcUrl] } } },
              transport: http()
            });

            const abiT = parseAbi(['function tradingNonces(address) view returns (uint256)']);
            const tradingNonce = await publicClient.readContract({
              address: e.claimer as `0x${string}`,
              abi: abiT,
              functionName: 'tradingNonces',
              args: [cleanAddress as `0x${string}`]
            });

            const { privateKeyToAccount } = await import('viem/accounts');
            const account = privateKeyToAccount(PRIV_KEY as `0x${string}`);

            const signature = await account.signTypedData({
              domain: {
                name: 'WhaleTownRewards',
                version: '1',
                chainId: e.chainId,
                verifyingContract: e.claimer as `0x${string}`,
              },
              types: {
                TradingClaim: [
                  { name: 'wallet', type: 'address' },
                  { name: 'amount', type: 'uint256' },
                  { name: 'nonce', type: 'uint256' },
                ],
              },
              primaryType: 'TradingClaim',
              message: {
                wallet: cleanAddress as `0x${string}`,
                amount: totalUnclaimedOPWei,
                nonce: tradingNonce,
              },
            });

            // Record pending events in DB
            const dbClient = await db.connect();
            try {
              await dbClient.query('BEGIN');
              for (const sale of unclaimedSales) {
                await dbClient.query(
                  'INSERT INTO economy_events (wallet, event_type, transaction_hash, points_awarded, claimed) VALUES ($1, \'purchase\', $2, $3, FALSE) ON CONFLICT DO NOTHING',
                  [cleanAddress, sale.hash, sale.amount.toString()]
                );
              }
              await dbClient.query(
                'INSERT INTO users (wallet, points_balance, lifetime_points) VALUES ($1, 0, 0) ON CONFLICT (wallet) DO UPDATE SET updated_at = NOW()',
                [cleanAddress]
              );
              await dbClient.query('COMMIT');
            } catch (e) {
              await dbClient.query('ROLLBACK');
              throw e;
            } finally {
              dbClient.release();
            }

            res.end(JSON.stringify({
              amount: totalUnclaimedOPWei.toString(),
              nonce: Number(tradingNonce),
              signature,
              salesPending: unclaimedSales.length
            }));
            return;
          }

          // /api/economy/sign-fishing-claim (POST)
          if (req.url === '/api/economy/sign-fishing-claim' && req.method === 'POST') {
            res.setHeader('Content-Type', 'application/json');
            const { address } = await getBody(req);
            const cleanAddress = (address || '').toLowerCase();

            // 1. Get unclaimed fishing rewards from DB (stored as wei)
            const unclaimedResult = await db.query('SELECT COALESCE(SUM(points_awarded), 0)::numeric as total FROM economy_events WHERE LOWER(wallet) = $1 AND event_type = \'fish\' AND claimed = FALSE', [cleanAddress]);
            const totalUnclaimedOPWei = BigInt(unclaimedResult.rows[0]?.total || 0);

            if (totalUnclaimedOPWei === BigInt(0)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'No unclaimed rewards' }));
              return;
            }

            // 2. Fetch nonce from contract (on-chain) using active env
            const e = devEnv();
            const PRIV_KEY = process.env.REWARDS_SIGNER_PRIVATE_KEY;

            if (!e.claimer || !PRIV_KEY) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: `Env vars not set (${e.isProd ? 'REWARDS_CLAIMER_CONTRACT' : 'TEST_REWARDS_CLAIMER_CONTRACT'} or REWARDS_SIGNER_PRIVATE_KEY)` }));
              return;
            }

            const { createPublicClient, http, parseAbi } = await import('viem');
            const publicClient = createPublicClient({
              chain: { id: e.chainId, name: e.chainName, nativeCurrency: { name: 'TMP', symbol: 'TMP', decimals: 18 }, rpcUrls: { default: { http: [e.rpcUrl] } } },
              transport: http()
            });

            const abi = parseAbi(['function fishingNonces(address) view returns (uint256)']);
            const fishingNonce = await publicClient.readContract({
              address: e.claimer as `0x${string}`,
              abi,
              functionName: 'fishingNonces',
              args: [cleanAddress as `0x${string}`]
            });

            // 3. Sign EIP-712
            const { privateKeyToAccount } = await import('viem/accounts');
            const account = privateKeyToAccount(PRIV_KEY as `0x${string}`);

            const signature = await account.signTypedData({
              domain: {
                name: 'WhaleTownRewards',
                version: '1',
                chainId: e.chainId,
                verifyingContract: e.claimer as `0x${string}`,
              },
              types: {
                FishingClaim: [
                  { name: 'wallet', type: 'address' },
                  { name: 'amount', type: 'uint256' },
                  { name: 'nonce', type: 'uint256' },
                ],
              },
              primaryType: 'FishingClaim',
              message: {
                wallet: cleanAddress as `0x${string}`,
                amount: totalUnclaimedOPWei,
                nonce: fishingNonce,
              },
            });

            res.end(JSON.stringify({
              amount: totalUnclaimedOPWei.toString(),
              nonce: Number(fishingNonce),
              signature
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
  const isProd = env.ENVIRONMENT === 'production' || mode === 'production';

  return {
    plugins: [react(), tailwindcss(), apiMiddleware()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.ALCHEMY_TEMPO_RPC': JSON.stringify(env.ALCHEMY_TEMPO_RPC || ''),
      'process.env.ALCHEMY_TEMPO_WEBSOCKET': JSON.stringify(env.ALCHEMY_TEMPO_WEBSOCKET || env.ALCHEMY__TEMPO_WEBSOCKET || ''),
      'process.env.NFT_CONTRACT': JSON.stringify(isProd ? env.NFT_CONTRACT : env.TEST_NFT_CONTRACT),
      'process.env.MARKETPLACE_CONTRACT': JSON.stringify(isProd ? env.MARKETPLACE_CONTRACT : env.TEST_MARKETPLACE_CONTRACT),
      'process.env.PATH_USD_CONTRACT': JSON.stringify(isProd ? env.PATH_USD_CONTRACT : env.TEST_PATH_USD_CONTRACT),
      'process.env.POINTS_CONTRACT': JSON.stringify(isProd ? env.POINTS_CONTRACT : env.TEST_POINTS_CONTRACT),
      'process.env.STAKING_CONTRACT': JSON.stringify(isProd ? env.STAKING_CONTRACT : env.TEST_STAKING_CONTRACT),
      'process.env.RPC_URL': JSON.stringify(isProd ? env.RPC_URL : env.TEST_RPC_URL),
      'process.env.CHAIN_ID': JSON.stringify(isProd ? (env.CHAIN_ID || '4217') : (env.TEST_CHAIN_ID || '42431')),
      'process.env.REWARDS_CLAIMER_CONTRACT': JSON.stringify(isProd ? env.REWARDS_CLAIMER_CONTRACT : env.TEST_REWARDS_CLAIMER_CONTRACT),
      'process.env.TREASURY_WALLET': JSON.stringify(isProd ? env.TREASURY_WALLET : env.TEST_TREASURY_WALLET),
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
