import { getPool } from './api/_db.js';

async function countTokens() {
  const db = await getPool();
  try {
    const result = await db.query('SELECT COUNT(*) as count FROM tokens');
    console.log('Token count:', result.rows[0].count);
    
    if (Number(result.rows[0].count) > 0) {
      const sample = await db.query('SELECT * FROM tokens LIMIT 1');
      console.log('Sample token:', JSON.stringify(sample.rows[0], null, 2));
    }
  } catch (e) {
    console.error('Error counting tokens:', e);
  } finally {
    process.exit();
  }
}

countTokens();
