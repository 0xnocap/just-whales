import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const WALLET = '0xf8ca2aacdeff99bfc9792fcf5c1b06a8a98bf927';

(async () => {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  try {
    const sales = await pool.query(
      `SELECT COUNT(*)::int as n, COALESCE(SUM(price::numeric), 0) as sum FROM sales WHERE LOWER(buyer) = $1`,
      [WALLET]
    );
    console.log(`sales.buyer = ${WALLET}: ${sales.rows[0].n} rows, total price=${sales.rows[0].sum}`);

    const mintedTo = await pool.query(
      `SELECT COUNT(*)::int as n FROM transfers WHERE LOWER("to") = $1 AND LOWER("from") = '0x0000000000000000000000000000000000000000'`,
      [WALLET]
    );
    console.log(`mint transfers TO this wallet: ${mintedTo.rows[0].n}`);

    const allTransfersIn = await pool.query(
      `SELECT COUNT(*)::int as n FROM transfers WHERE LOWER("to") = $1`,
      [WALLET]
    );
    const allTransfersOut = await pool.query(
      `SELECT COUNT(*)::int as n FROM transfers WHERE LOWER("from") = $1`,
      [WALLET]
    );
    console.log(`all transfers IN: ${allTransfersIn.rows[0].n}, OUT: ${allTransfersOut.rows[0].n}`);
    console.log(`implied current balance: ${allTransfersIn.rows[0].n - allTransfersOut.rows[0].n}`);
  } finally {
    await pool.end();
  }
})();
