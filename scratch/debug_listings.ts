
import { getPool } from '../api/_db.js';

async function debugListings() {
  const db = await getPool();
  try {
    console.log('--- Latest 5 Listings ---');
    const listed = await db.query(`SELECT listing_id, token_id, seller, timestamp FROM listed ORDER BY timestamp DESC LIMIT 5`);
    console.log(listed.rows);

    console.log('--- Latest 5 Cancellations ---');
    const canceled = await db.query(`SELECT listing_id, timestamp FROM canceled ORDER BY timestamp DESC LIMIT 5`);
    console.log(canceled.rows);

    console.log('--- Checking for matches ---');
    if (canceled.rows.length > 0) {
      const ids = canceled.rows.map(r => r.listing_id);
      const matches = await db.query(`SELECT listing_id, token_id FROM listed WHERE listing_id IN (${ids.join(',')})`);
      console.log('Canceled listings found in listed table:', matches.rows);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

debugListings();
