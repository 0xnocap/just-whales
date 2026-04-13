import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Optimistic Sale API
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { listingId, buyer, transactionHash } = req.body;

  if (!listingId) {
    return res.status(400).json({ error: 'Missing listingId' });
  }

  try {
    const db = await getPool();
    
    // Optimistically mark as sold.
    // We insert into sales. We might not have all columns like price/seller 
    // but the listings query just checks for listing_id in sales.
    await db.query(`
      INSERT INTO sales (listing_id, buyer, transaction_hash, timestamp)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [
      listingId.toString(), 
      buyer || 'optimistic', 
      transactionHash || 'optimistic', 
      Math.floor(Date.now() / 1000)
    ]);

    res.status(200).json({ success: true, message: 'Optimistically sold' });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
