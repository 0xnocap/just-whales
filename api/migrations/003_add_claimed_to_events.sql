-- Add claimed status to economy_events to track what has been minted on-chain via RewardsClaimer
ALTER TABLE economy_events ADD COLUMN IF NOT EXISTS claimed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE economy_events ADD COLUMN IF NOT EXISTS claim_tx_hash VARCHAR(66);
CREATE INDEX IF NOT EXISTS idx_economy_events_unclaimed ON economy_events (wallet, event_type, claimed) WHERE claimed = FALSE;
