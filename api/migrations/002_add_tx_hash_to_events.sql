-- Add transaction_hash to economy_events to track source transactions (e.g. for trading rewards)
ALTER TABLE economy_events ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(66);
CREATE INDEX IF NOT EXISTS idx_economy_events_tx_hash ON economy_events (transaction_hash);
