import { getPool } from '../api/_db.js';

async function setupDB() {
  const pool = await getPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS economy_events (
        id SERIAL PRIMARY KEY,
        wallet VARCHAR(42) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        points_awarded INTEGER NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_economy_events_wallet_time ON economy_events (wallet, timestamp);

      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        nft_contract VARCHAR(42) NOT NULL,
        token_id INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'available',
        claimed_by VARCHAR(42),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS redemptions (
        id SERIAL PRIMARY KEY,
        wallet VARCHAR(42) NOT NULL,
        inventory_id INTEGER REFERENCES inventory(id),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Economy tables created successfully.");
  } catch (e) {
    console.error("Error creating tables:", e);
  } finally {
    process.exit(0);
  }
}

setupDB();
