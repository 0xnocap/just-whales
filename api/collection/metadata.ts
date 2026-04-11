import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { ids } = req.query;
  if (!ids) {
    return res.status(400).json({ error: 'Missing ids parameter' });
  }

  try {
    const db = await getPool();
    const idArray = (ids as string)
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));
    
    if (idArray.length === 0) {
      return res.status(200).json({});
    }

    const result = await db.query(
      'SELECT token_id, metadata FROM tokens WHERE token_id = ANY($1)',
      [idArray]
    );

    // Map by token_id for easy frontend consumption
    const metadataMap = result.rows.reduce((acc: any, row: any) => {
      acc[row.token_id] = row.metadata;
      return acc;
    }, {});

    // Set cache headers for performance (1 hour browser cache, 1 day proxy cache)
    res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600');
    res.status(200).json(metadataMap);
  } catch (err: any) {
    console.error('Metadata API Error:', err);
    res.status(500).json({ error: err.message });
  }
}
