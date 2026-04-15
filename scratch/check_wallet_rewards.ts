/**
 * Find buyers with 19 purchases and cross-check their unclaimed rewards.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const buyers = await pool.query(`
      SELECT LOWER(buyer) as wallet, COUNT(*) as n, SUM(price::numeric) as sum_price
      FROM sales
      GROUP BY LOWER(buyer)
      HAVING COUNT(*) = 19
      ORDER BY n DESC
    `);
    console.log('=== Buyers with exactly 19 purchases ===');
    for (const row of buyers.rows) {
      const sumPrice = BigInt(row.sum_price);
      const opWei = sumPrice * BigInt(10 ** 13);
      const opFormatted = (Number(opWei) / 1e18).toFixed(2);
      const dollars = (Number(sumPrice) / 1e6).toFixed(2);
      console.log(`  ${row.wallet}: ${row.n} purchases, $${dollars} spent, ${opFormatted} $OP`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
