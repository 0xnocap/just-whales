import { getPool } from './_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getPool();
    
    const [tokenCount, listedCount, tokensSample, listingsSample] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM tokens'),
      db.query('SELECT COUNT(*) as count FROM listed'),
      db.query('SELECT * FROM tokens LIMIT 3'),
      db.query('SELECT * FROM listed LIMIT 3')
    ]);

    // Check for a specific ID that we saw failing
    const specificToken = await db.query('SELECT * FROM tokens WHERE token_id::text = $1 OR token_id::text = $2', ['2452', '02452']);

    res.status(200).json({
      summary: {
        tokensInDb: Number(tokenCount.rows[0].count),
        listingsInDb: Number(listedCount.rows[0].count)
      },
      tokensSample: tokensSample.rows,
      listingsSample: listingsSample.rows,
      specificTokenCheck: specificToken.rows,
      schemaCheck: {
        tokens: (await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tokens'`)).rows,
        listed: (await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'listed'`)).rows
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
