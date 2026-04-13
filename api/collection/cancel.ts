import { getPool } from '../_db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Optimistic Cancellation API
 * This endpoint allows the frontend to "soft cancel" a listing immediately after 
 * the user has initiated the on-chain transaction. This bridges the 3-10s gap 
 * between the TX being sent and the indexer catching the event.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { listingId, transactionHash } = req.body;

  if (!listingId) {
    return res.status(400).json({ error: 'Missing listingId' });
  }

  try {
    const db = await getPool();
    
    // We insert into the canceled table optimistically.
    // If the indexer later processes the same listing_id, it will be a no-op 
    // or update with the real block data.
    // Note: listing_id is numeric in the schema.
    await db.query(`
      INSERT INTO canceled (listing_id, transaction_hash, timestamp)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [
      listingId.toString(), 
      transactionHash || 'optimistic', 
      Math.floor(Date.now() / 1000)
    ]);

    res.status(200).json({ success: true, message: 'Optimistically canceled' });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
