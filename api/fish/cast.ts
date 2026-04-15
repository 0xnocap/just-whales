import { getPool } from '../_db.js';
import { FISH_LIST, NO_BITE_MESSAGES, FREE_DAILY_ATTEMPTS, TACKLE_BOX_ATTEMPTS } from './_gameData.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { address } = req.body;
    if (!address || typeof address !== 'string') {
      res.status(400).json({ error: 'Missing or invalid address parameter' });
      return;
    }

    const cleanAddress = address.toLowerCase();
    const db = await getPool();

    // 1. Check daily attempts
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const attemptsResult = await db.query(`
      SELECT COUNT(*)::int as count
      FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'fish' AND created_at >= $2
    `, [cleanAddress, today]);

    const tackleBoxResult = await db.query(`
      SELECT COUNT(*)::int as count
      FROM game_events
      WHERE LOWER(wallet) = $1 AND game = 'tackle_box' AND created_at >= $2
    `, [cleanAddress, today]);

    const hasTackleBox = tackleBoxResult.rows[0].count > 0;
    const totalAllowed = FREE_DAILY_ATTEMPTS + (hasTackleBox ? TACKLE_BOX_ATTEMPTS : 0);
    const usedAttempts = attemptsResult.rows[0].count;

    if (usedAttempts >= totalAllowed) {
      res.status(403).json({ 
        error: 'No attempts remaining today',
        used: usedAttempts,
        total: totalAllowed,
        hasTackleBox
      });
      return;
    }

    // 2. Server-side RNG
    const isBite = Math.random() > 0.5;
    
    if (!isBite) {
      // Record no-bite as a cast so it counts toward the daily limit
      await db.query(`
        INSERT INTO game_events (wallet, game, result, points_earned)
        VALUES ($1, 'fish', $2, 0)
      `, [cleanAddress, JSON.stringify({ result: 'no_bite' })]);

      const message = NO_BITE_MESSAGES[Math.floor(Math.random() * NO_BITE_MESSAGES.length)];
      res.status(200).json({ result: 'no_bite', message, attemptsRemaining: totalAllowed - usedAttempts - 1 });
      return;
    }

    // Resolve Catch
    const roll = Math.random() * 100;
    let caughtFish;

    if (roll > 99) {
      const nfts = FISH_LIST.filter(f => f.rarity === 'NFT');
      const nftRoll = Math.random() * 100;
      if (nftRoll > 95) caughtFish = nfts.find(n => n.nftTier === 'Legendary');
      else if (nftRoll > 80) caughtFish = nfts.find(n => n.nftTier === 'Ultra Rare');
      else if (nftRoll > 50) caughtFish = nfts.find(n => n.nftTier === 'Rare');
      else caughtFish = nfts.find(n => n.nftTier === 'Common');
      if (!caughtFish) caughtFish = nfts[Math.floor(Math.random() * nfts.length)];
    } else if (roll > 96) {
      const legendaries = FISH_LIST.filter(f => f.rarity === 'Legendary');
      caughtFish = legendaries[Math.floor(Math.random() * legendaries.length)];
    } else if (roll > 90) {
      const epics = FISH_LIST.filter(f => f.rarity === 'Epic');
      caughtFish = epics[Math.floor(Math.random() * epics.length)];
    } else if (roll > 80) {
      const rares = FISH_LIST.filter(f => f.rarity === 'Rare');
      caughtFish = rares[Math.floor(Math.random() * rares.length)];
    } else if (roll > 65) {
      const uncommons = FISH_LIST.filter(f => f.rarity === 'Uncommon');
      caughtFish = uncommons[Math.floor(Math.random() * uncommons.length)];
    } else if (roll > 35) {
      const junks = FISH_LIST.filter(f => f.rarity === 'Junk');
      caughtFish = junks[Math.floor(Math.random() * junks.length)];
    } else {
      const commons = FISH_LIST.filter(f => f.rarity === 'Common');
      caughtFish = commons[Math.floor(Math.random() * commons.length)];
    }

    // 3. Record in game_events
    const recordResult = await db.query(`
      INSERT INTO game_events (wallet, game, result, points_earned, prize_tier)
      VALUES ($1, 'fish', $2, $3, $4)
      RETURNING id
    `, [
      cleanAddress, 
      JSON.stringify(caughtFish), 
      caughtFish.value, 
      caughtFish.rarity === 'NFT' ? caughtFish.nftTier?.toLowerCase() : null
    ]);

    res.status(200).json({ 
      result: 'catch', 
      fish: caughtFish, 
      gameEventId: recordResult.rows[0].id,
      attemptsRemaining: totalAllowed - usedAttempts - 1
    });
  } catch (err: any) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
