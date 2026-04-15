# Whale Town - Economy System Save Point

**Date:** 2026-04-14
**Session origin:** https://github.com/0xnocap/just-whales.git

---

## Goal

Build and ship the Whale Town points economy system. Specific targets:
1. **Fix activity feed bug** - trading page activity tab and live activity sidebar only showed transfers, not sales/listings
2. **Build trading rewards** - $1 pathUSD spent = 10 $OP, claimable
3. **Build fishing game wiring** - server-side RNG, wallet integration, $OP spend (Tackle Box) and earn (sell fish), named "Tackle Box" not "Supply Pack"
4. **Write execution plan** - document everything in ECONOMY_EXECUTION_PLAN.md

---

## Instructions

- Claims should be **claimable**, not auto-deposited. Same UX as staking.
- On-chain $OP transfer for **Tackle Box** purchases (100 $OP = 10 casts)
- **Tackle Box** (not "Supply Pack") - rename everywhere
- **Treasury wallet** = `0x7831959816fAA58B5Dc869b7692cebdb6EFC311E` (ops wallet, same as signer)
- EIP-712 **signature-based claims** so users pay their own gas (RewardsClaimer contract pattern)
- Signing wallet is an **EOA only** (contracts can't sign), but the **RewardsClaimer contract** holds MINTER_ROLE and does the actual minting
- Rolling cap: **1,000 $OP/hr for fishing only** (not trading, not staking)
- Fish values stored as **human-readable $OP integers** (e.g. 50, 2500), convert to wei only at claim time
- No-bite casts **count against daily attempt limit**
- After signing, **don't mark as claimed until on-chain confirmation** (prevent lost rewards on failed tx)
- `contracts/.env` `PRIVATE_KEY` = `0xcb6c64a97069bc73b4a5f13ffba035bf8815278f2568b547a1b4c5060b4d9f2a` = `0x7831959816fAA58B5Dc869b7692cebdb6EFC311E` (confirmed)
- This key **already has MINTER_ROLE** on $OP contract (verified on-chain)
- Vercel deploys `api/` folder; vite dev server has middleware in `vite.config.ts` that mirrors all API endpoints locally

---

## Discoveries

### Activity Feed Bug (FIXED)
- **Root cause:** Staking contract (`0x650f...`) generated hundreds of recent Transfer events, flooding the `LIMIT 100` query. Every sale also emits a duplicate Transfer in the same tx.
- **Fix:** Filter transfers where `to` or `from` = staking contract. Exclude transfers where `transaction_hash` exists in `sales` table.
- **Files fixed:** `api/activity.ts`, `vite.config.ts` dev middleware

### Database State
- Economy tables: `users` (0 rows), `purchases` (0 rows), `economy_events` (0 rows), `game_events` (0 rows), `inventory` (0 rows), `redemptions` (0 rows), `staking_positions` (0 rows), `reward_rates` (11 rows - seeded)
- Goldsky indexer tables have real data: transfers (7,186), sales (848), listed (1,679), canceled (546)
- `reward_rates` has staking body/trait rates + rolling cap. Missing: `purchase.per_dollar`, `fishing.tackle_box_cost`, `fishing.free_daily_casts` (seeded in migration 004)

### Contracts on Mainnet (Tempo chain 4217)
- NFT: `0x1065ef5996C86C8C90D97974F3c9E5234416839F`
- Marketplace: `0x26CC31587Faa3334e7bbfC9A2255E1c1434FdbBe`
- $OP Token: `0xCf4A2079A2c058d266A0999F3fCA256d6F1F53a9`
- Staking: `0x650F7fd9084b8631e16780A90BBed731679598F0`
- Ops/Signer/Treasury: `0x7831959816fAA58B5Dc869b7692cebdb6EFC311E`
- Deployer: `0x49CF10c489E60Bcb405AfE8C4E577B9D7e3a65C`

### Fish Game Constants
- 67 fish types across rarities: Common, Junk, Uncommon, Rare, Epic, Ultra Rare, Legendary, NFT
- NFT prizes: Barnacle Key (Common), Sunken Compass (Rare), Ancient Pearl (Ultra Rare), Ocean King Crown (Legendary)
- 50% bite chance per cast; rarity rolls within bite
- `FREE_DAILY_ATTEMPTS = 5`, `TACKLE_BOX_COST = 100 $OP`, `TACKLE_BOX_ATTEMPTS = 10`
- Legacy: fully client-side/localStorage

### Profile Activity Bug (FIXED)
- Profile activity tab only queried `transfers` table, missing sales/listings/cancels/mints
- Fixed both `api/profile/[address].ts` and vite dev middleware
- Profile page now renders all activity types via shared `ActivityItem` component

### Economy Execution Plan Written
- `ECONOMY_EXECUTION_PLAN.md` created in project root
- Covers all phases with exact API shapes, SQL queries, component responsibilities

---

## Accomplished

### Fixed Activity Feed Bug (COMMITTED)
- `api/activity.ts`: filter staking transfers + dedup sale transfers
- `vite.config.ts`: same fix in dev middleware
- `api/profile/[address].ts`: full activity rewrite (mint/transfer/sale/list/cancel)
- `vite.config.ts` profile middleware: same rewrite
- `src/components/ActivityItem.tsx`: added `mint` type with Gem icon
- `src/pages/ProfilePage.tsx`: replaced inline rendering with ActivityItem
- **Committed & pushed** as `fix(activity): filter staking transfers and show sales/listings in activity feeds`

### Written Economy Execution Plan
- `ECONOMY_EXECUTION_PLAN.md` in project root
- Covers: RewardsClaimer contract spec, trading rewards backend/frontend, fish game backend/frontend, DB changes, env vars, build order

### Created Vault Project Note
- `projects/whale-town.md` in Obsidian vault
- Added to `atlas/projects.md` Active/In Progress section

### Built Economy System (UNCOMMITTED - IN PROGRESS)
Full implementation per the execution plan:

**Contracts:**
- `contracts/contracts/economy/RewardsClaimer.sol` - EIP-712 signature-based claimer
- `contracts/test/WhaleTownRewards.t.sol` - 8 Foundry tests (all passing per user)
- `contracts/script/DeployRewardsClaimer.s.sol` - deploy + grant MINTER_ROLE

**DB Migrations:**
- `api/migrations/002_add_tx_hash_to_events.sql` - adds transaction_hash column
- `api/migrations/003_add_claimed_to_events.sql` - adds claimed + claim_tx_hash columns
- `api/migrations/004_seed_more_rates.sql` - seeds purchase/fishing rate constants

**Backend:**
- `api/_signer.ts` - EIP-712 signing with viem
- `api/economy/rewards/[address].ts` - rewards summary (unclaimed trading + fishing)
- `api/economy/sign-trading-claim.ts` - signs trading claims
- `api/economy/sign-fishing-claim.ts` - signs fishing claims
- `api/economy/confirm-claim.ts` - marks events as claimed after on-chain confirmation
- `api/fish/_gameData.ts` - server-side fish list + constants
- `api/fish/cast.ts` - server-side RNG, counts no-bites as casts
- `api/fish/sell.ts` - sells fish, applies rolling cap
- `api/fish/buy-tackle-box.ts` - verifies on-chain transfer, grants casts
- `api/fish/state/[address].ts` - game state (casts remaining, inventory, journal, unclaimed)

**Frontend:**
- `src/hooks/useRewards.ts` - polling hook with claim + confirm flow
- `src/hooks/useFishGameServer.ts` - server-backed fish game state
- `src/pages/ProfilePage.tsx` - added Rewards tab
- `src/pages/FishPage.tsx` - wallet gate, server-backed state
- `src/components/fish/GameScene.tsx` - server-side RNG wired up
- `contract.js` - added REWARDS_CLAIMER_ADDRESS + ABI
- `src/contract.ts` - exports rewardsClaimerAddress + rewardsClaimerAbi
- `vite.config.ts` - dev middleware for all new endpoints

---

## In Progress - BUG FIXES APPLIED (NOT YET VERIFIED/COMMITTED)

The session was **interrupted mid-edit** while fixing bugs in the economy implementation. The following edits were applied but NOT committed or verified:

1. `api/economy/sign-trading-claim.ts` - changed `claimed = TRUE` to `claimed = FALSE` + added `ON CONFLICT DO NOTHING` + removed users balance update
2. `api/economy/rewards/[address].ts` - updated query to select `claimed` column too
3. `api/economy/confirm-claim.ts` - **new file created** but NOT added to vite dev middleware
4. `src/hooks/useRewards.ts` - added `pendingClaimType` state + confirm-on-success effect + `setPendingClaimType()` calls in both claim functions
5. `api/fish/cast.ts` - added no-bite record insertion before returning
6. `api/fish/sell.ts` - removed `awardedWei` multiplication, storing plain integers

**Still needs doing:**
- Verify `useFishGameServer.ts`: `TREASURY_WALLET` is hardcoded to `0x49CF10c489...` - treasury should be `0x7831959816fAA58B5Dc869b7692cebdb6EFC311E`
- Verify `sell.ts` rolling cap logic is correct (now using plain integers)
- Remove leftover `awardedWei` / `overflowWei` lines in `sell.ts` if any remain
- Add `confirm-claim` endpoint to vite dev middleware
- Fix import paths in `src/hooks/useRewards.ts` and `src/hooks/useFishGameServer.ts` (changed `@/contract` to `../contract` - already done, build passes)
- Commit everything and push
- Verify the vite dev middleware covers all new endpoints

---

## Relevant Files / Directories

### Activity Feed Fix (COMMITTED)
- `api/activity.ts` - global activity with staking filter
- `api/profile/[address].ts` - profile activity with all types
- `vite.config.ts` - dev middleware
- `src/components/ActivityItem.tsx` - shared activity item with mint type
- `src/pages/ProfilePage.tsx` - uses ActivityItem for activity tab

### Economy System (UNCOMMITTED - IN PROGRESS)
**Contracts:**
- `contracts/contracts/economy/RewardsClaimer.sol`
- `contracts/test/WhaleTownRewards.t.sol`
- `contracts/script/DeployRewardsClaimer.s.sol`

**Migrations:**
- `api/migrations/002_add_tx_hash_to_events.sql`
- `api/migrations/003_add_claimed_to_events.sql`
- `api/migrations/004_seed_more_rates.sql`

**Backend:**
- `api/_signer.ts`
- `api/economy/rewards/[address].ts` ⚠️
- `api/economy/sign-trading-claim.ts` ⚠️
- `api/economy/sign-fishing-claim.ts` ⚠️
- `api/economy/confirm-claim.ts` ⚠️ (new file)
- `api/fish/_gameData.ts`
- `api/fish/cast.ts` ⚠️
- `api/fish/sell.ts` ⚠️
- `api/fish/buy-tackle-box.ts`
- `api/fish/state/[address].ts`

**Frontend:**
- `src/hooks/useRewards.ts` ⚠️
- `src/hooks/useFishGameServer.ts` ⚠️
- `src/pages/ProfilePage.tsx`
- `src/pages/FishPage.tsx`
- `src/components/fish/GameScene.tsx`
- `contract.js`
- `src/contract.ts`
- `vite.config.ts` ⚠️

**Docs:**
- `ECONOMY_EXECUTION_PLAN.md` (created, NOT updated with bug fixes yet)
- `econonmy-technical-spec.md` (existing)
- `econonmy-outline.md` (existing)
- `projects/whale-town.md` (created in Obsidian vault)

**Config:**
- `contracts/.env` - contains `PRIVATE_KEY` = signer wallet
- `.env` - needs `REWARDS_SIGNER_PRIVATE_KEY`, `REWARDS_CLAIMER_CONTRACT`, `TREASURY_WALLET`

---

## How to Resume

1. **Verify build:** Run `npx vite build` from project root to check for errors (currently passing)
2. **Fix remaining issues:** 
   - Verify `TREASURY_WALLET` in `useFishGameServer.ts` is `0x7831959816fAA58B5Dc869b7692cebdb6EFC311E`
   - Verify `sell.ts` rolling cap logic is correct (now using plain integers)
   - Add `confirm-claim` endpoint to vite dev middleware
   - Fix any LSP errors in the modified files
3. **Commit:** `git add` all economy changes, commit with message, push
4. **Deploy contract:** Run `DeployRewardsClaimer.s.sol` on mainnet, get the deployed address
5. **Update env vars:** Add `REWARDS_CLAIMER_CONTRACT`, `REWARDS_SIGNER_PRIVATE_KEY` (same as `contracts/.env` PRIVATE_KEY), `TREASURY_WALLET` = `0x7831959816fAA58B5Dc869b7692cebdb6EFC311E` to both `.env` and Vercel
6. **Grant MINTER_ROLE:** `$OP.grantRole(MINTER_ROLE, rewardsClaimerAddress)` from admin wallet
7. **Update plan:** Edit `ECONOMY_EXECUTION_PLAN.md` to reflect the bug fixes applied
