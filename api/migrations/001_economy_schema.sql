-- Whale-Town Points Economy schema
-- Derived from econonmy-technical-spec.md section 10
-- NOTE: idempotent. All CREATE TABLE statements use IF NOT EXISTS.
-- DO NOT add DROP TABLE here — it will wipe columns added by later migrations.

-- ---------------------------------------------------------------------------
-- users: canonical wallet registry + cached points balance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    wallet              VARCHAR(42) PRIMARY KEY,
    discord_id          VARCHAR(64),
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    points_balance      NUMERIC(38, 0) NOT NULL DEFAULT 0,
    lifetime_points     NUMERIC(38, 0) NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- staking_positions: offchain mirror of onchain stakes for analytics / UI
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staking_positions (
    id                  BIGSERIAL PRIMARY KEY,
    wallet              VARCHAR(42) NOT NULL,
    nft_contract        VARCHAR(42) NOT NULL,
    token_id            INTEGER NOT NULL,
    staked_at           TIMESTAMPTZ NOT NULL,
    unstaked_at         TIMESTAMPTZ,
    rate_tier           VARCHAR(32) NOT NULL,
    trait_flags         JSONB NOT NULL DEFAULT '{}'::jsonb,
    accrued_points      NUMERIC(38, 0) NOT NULL DEFAULT 0,
    UNIQUE (nft_contract, token_id, staked_at)
);
CREATE INDEX IF NOT EXISTS idx_staking_wallet ON staking_positions (wallet);
CREATE INDEX IF NOT EXISTS idx_staking_active ON staking_positions (wallet) WHERE unstaked_at IS NULL;

-- ---------------------------------------------------------------------------
-- purchases: marketplace purchase events awaiting batch mint
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
    id                  BIGSERIAL PRIMARY KEY,
    wallet              VARCHAR(42) NOT NULL,
    nft_contract        VARCHAR(42) NOT NULL,
    token_id            INTEGER NOT NULL,
    price_wei           NUMERIC(78, 0) NOT NULL,
    purchased_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    points_due          NUMERIC(38, 0) NOT NULL,
    minted              BOOLEAN NOT NULL DEFAULT FALSE,
    mint_tx_hash        VARCHAR(66),
    tx_hash             VARCHAR(66) NOT NULL,
    UNIQUE (tx_hash, token_id)
);
CREATE INDEX IF NOT EXISTS idx_purchases_unminted ON purchases (wallet) WHERE minted = FALSE;

-- ---------------------------------------------------------------------------
-- game_events: fishing / minigame results
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_events (
    id                  BIGSERIAL PRIMARY KEY,
    wallet              VARCHAR(42) NOT NULL,
    game                VARCHAR(32) NOT NULL DEFAULT 'fish',
    result              JSONB NOT NULL,
    points_earned       NUMERIC(38, 0) NOT NULL DEFAULT 0,
    prize_tier          VARCHAR(16), -- common | rare | epic | legendary | NULL
    redeemed            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_game_wallet ON game_events (wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_unredeemed ON game_events (wallet) WHERE redeemed = FALSE AND prize_tier IS NOT NULL;

-- ---------------------------------------------------------------------------
-- inventory: treasury-held external NFTs available for redemption
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
    id                  BIGSERIAL PRIMARY KEY,
    nft_contract        VARCHAR(42) NOT NULL,
    token_id            INTEGER NOT NULL,
    prize_tier          VARCHAR(16) NOT NULL, -- common | rare | epic | legendary
    status              VARCHAR(16) NOT NULL DEFAULT 'available', -- available | reserved | claimed
    claimed_by          VARCHAR(42),
    claimed_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (nft_contract, token_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_available ON inventory (prize_tier) WHERE status = 'available';

-- ---------------------------------------------------------------------------
-- redemptions: user redemption history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS redemptions (
    id                  BIGSERIAL PRIMARY KEY,
    wallet              VARCHAR(42) NOT NULL,
    inventory_id        BIGINT REFERENCES inventory(id),
    reward_type         VARCHAR(32) NOT NULL, -- nft | wl_ticket | boost | other
    points_spent        NUMERIC(38, 0) NOT NULL,
    tx_hash             VARCHAR(66),
    status              VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending | completed | failed
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_redemptions_wallet ON redemptions (wallet, created_at DESC);

-- ---------------------------------------------------------------------------
-- economy_events: rolling 60-min cap ledger (spec §6)
-- every point award is appended here, regardless of source
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS economy_events (
    id                  BIGSERIAL PRIMARY KEY,
    wallet              VARCHAR(42) NOT NULL,
    event_type          VARCHAR(32) NOT NULL, -- purchase | fish | staking_claim | leaderboard | admin
    source_id           BIGINT, -- FK-ish pointer to purchases/game_events/etc row
    points_awarded      NUMERIC(38, 0) NOT NULL,
    points_overflow     NUMERIC(38, 0) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_economy_events_wallet_time ON economy_events (wallet, created_at DESC);

-- ---------------------------------------------------------------------------
-- reward_rates: admin-tunable point tables (spec §2.8, §4)
-- stored as flexible key/value so admins can adjust without migrations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reward_rates (
    key                 VARCHAR(64) PRIMARY KEY,
    category            VARCHAR(32) NOT NULL, -- body | trait | purchase | fishing | leaderboard | cap
    value               NUMERIC(38, 0) NOT NULL,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default rates from spec §4
INSERT INTO reward_rates (key, category, value, metadata) VALUES
    ('body.sea_lion',                     'body',  5,  '{"label":"Sea Lion"}'::jsonb),
    ('body.shark',                        'body',  10, '{"label":"Shark"}'::jsonb),
    ('body.whale',                        'body',  20, '{"label":"Whale"}'::jsonb),
    ('body.golden_whale',                 'body',  35, '{"label":"Golden Whale","rare":true}'::jsonb),
    ('body.white_spotted_sea_lion',       'body',  20, '{"label":"White Spotted Sea Lion","rare":true}'::jsonb),
    ('body.great_white_shark',            'body',  20, '{"label":"Great White Shark","rare":true}'::jsonb),
    ('trait.sea_lion_gold_chain',         'trait', 10, '{"label":"Sea Lion Gold Chain"}'::jsonb),
    ('trait.shark_pirate_captain_coat',   'trait', 15, '{"label":"Shark Pirate Captain Coat"}'::jsonb),
    ('trait.diamond_watch_whale',         'trait', 30, '{"label":"Diamond Watch Whale"}'::jsonb),
    ('trait.gold_watch_whale',            'trait', 25, '{"label":"Gold Watch Whale"}'::jsonb),
    ('cap.rolling_60min',                 'cap',   1000, '{"window_seconds":3600}'::jsonb)
ON CONFLICT (key) DO NOTHING;
