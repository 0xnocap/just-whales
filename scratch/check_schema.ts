import { getPool } from './api/_db.js';

async function checkSchema() {
  const db = await getPool();
  try {
    const tokensSchema = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tokens' AND column_name = 'token_id'
    `);
    console.log('Tokens Schema:', tokensSchema.rows);

    const listedSchema = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'listed' AND column_name = 'token_id'
    `);
    console.log('Listed Schema:', listedSchema.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

checkSchema();
