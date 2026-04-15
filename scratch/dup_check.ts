import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const r = await pool.query(`
    SELECT LOWER(wallet) as w, event_type, transaction_hash, COUNT(*) as n
    FROM economy_events
    WHERE transaction_hash IS NOT NULL
    GROUP BY LOWER(wallet), event_type, transaction_hash
    HAVING COUNT(*) > 1
    ORDER BY n DESC
  `);
  console.log(`duplicate (wallet, event_type, tx_hash) groups: ${r.rows.length}`);
  r.rows.slice(0, 20).forEach(row => console.log(`  ${row.w} ${row.event_type} ${row.transaction_hash} x${row.n}`));

  const sales = await pool.query(`
    SELECT LOWER(buyer) as b, transaction_hash, COUNT(*) as n
    FROM sales GROUP BY LOWER(buyer), transaction_hash HAVING COUNT(*) > 1 ORDER BY n DESC LIMIT 10
  `);
  console.log(`\nsales rows sharing tx_hash (multi-NFT): ${sales.rows.length} groups`);
  sales.rows.forEach(row => console.log(`  ${row.b} ${row.transaction_hash} x${row.n}`));
  await pool.end();
})();
