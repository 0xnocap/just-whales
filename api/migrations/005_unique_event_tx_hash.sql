-- Enforce one economy_events row per (wallet, event_type, transaction_hash).
-- Multi-NFT purchases collapse into a single row with summed points_awarded.
-- NULL transaction_hash (e.g. fish events) is not constrained — Postgres treats NULLs as distinct.
CREATE UNIQUE INDEX IF NOT EXISTS uq_economy_events_wallet_type_tx
    ON economy_events (wallet, event_type, transaction_hash)
    WHERE transaction_hash IS NOT NULL;
