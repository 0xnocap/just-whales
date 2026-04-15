# Whale Town Economy — Status Report

**Last updated:** 2026-04-14
**Current branch:** main (preprod/staging — production is a separate forked repo)

---

## TL;DR

The economy system has been refactored for environment-aware config, the
database migrations are applied to Render, and the EIP-712 signature
round trip has been verified end-to-end against the Tempo testnet with
a real on-chain claim. Trading rewards are one env-var-push away from
being live on mainnet.

---

## Smart Contract Deployments

### Mainnet — `0xfEAA26Fff4687028dDbb8904c3c7ceFe4abc0817`
- Chain: Tempo Mainnet (4217)
- Deployed via Hardhat (`contracts/scripts/deploy-rewards-claimer.js`)
- `points()` = `0xCf4A2079A2c058d266A0999F3fCA256d6F1F53a9` (mainnet $OP)
- `authorizedSigner()` = `0x7831959816fAA58B5Dc869b7692cebdb6EFC311E`
- `MINTER_ROLE` on $OP: **granted** (verified on-chain)
- `eip712Domain()` returns name=`WhaleTownRewards`, version=`1`, chainId=4217, verifyingContract=self

### Testnet — `0xb2877314D63dF74FF66dcdE91B6afe7D36AFa687`
- Chain: Tempo Moderato Testnet (42431)
- Deployed via Hardhat
- `points()` = `0xe5a7d520fbeBAaADb60cB80FD31ffb74f564d15d` (test $OP)
- `authorizedSigner()` = `0x7831959816fAA58B5Dc869b7692cebdb6EFC311E`
- `MINTER_ROLE` on test $OP: **granted** (verified on-chain)
- `eip712Domain()` returns name=`WhaleTownRewards`, version=`1`, chainId=42431, verifyingContract=self

Foundry deploy attempt at `0xe454041a894825d1DED51aAEC56cDe78736B1106` reverted
and has no code on-chain. The forge broadcast artifact still exists at
`contracts/broadcast/DeployRewardsClaimer.s.sol/42431/` as a dead-letter
record and can be deleted at any time.

---

## Database State (Render, production)

Schema applied as of commit `e70ea71`:

- `economy_events` columns: `id, wallet, event_type, source_id, points_awarded, points_overflow, created_at, transaction_hash, claimed, claim_tx_hash` ✓
- `idx_economy_events_tx_hash` index: present
- `idx_economy_events_unclaimed` partial index (wallet, event_type, claimed) WHERE claimed = FALSE: present
- `reward_rates` seeds from migration 004 (`purchase.per_dollar`, `fishing.tackle_box_cost`, `fishing.free_daily_casts`): present

**Important:** running `npx tsx api/migrations/run.ts` will re-execute migration
001, which begins with `DROP TABLE IF EXISTS economy_events CASCADE` and
wipes the 002/003 columns in the process (they are re-added by 002/003 if the
full chain runs to completion, but a partial run leaves the DB in a bad state).
If you only need to add missing columns, use `scratch/apply_migrations_002_003.ts`
which runs only the idempotent ALTER statements.

---

## Backend Refactor (commit `e70ea71`)

### `api/_env.ts` — new central config helper
Reads `ENVIRONMENT` and returns the correct RPC URL, chain ID, RewardsClaimer
address, POINTS_CONTRACT, and treasury wallet. Falls back to `TEST_*` env vars
when `ENVIRONMENT != 'production'`. Exposes `requireX()` assertions so missing
env vars fail loudly.

### `api/_signer.ts` — lazy per-call domain build
Previously captured `chainId`, `verifyingContract`, and the account at module
load time, meaning env changes needed a cold restart. Now rebuilds the EIP-712
domain on every signing call via `getEnvConfig()`, and throws a clear error
if `REWARDS_SIGNER_PRIVATE_KEY` or `REWARDS_CLAIMER_CONTRACT` is missing.

### Endpoints switched to `getEnvConfig()`
- `api/economy/rewards/[address].ts`
- `api/economy/sign-trading-claim.ts`
- `api/economy/sign-fishing-claim.ts`
- `api/fish/buy-tackle-box.ts`

All four previously read `process.env.REWARDS_CLAIMER_CONTRACT`, `RPC_URL`,
and `CHAIN_ID` directly without any testnet fallback.

### `points_awarded` unit normalization
Previously `economy_events.points_awarded` stored **wei** for `purchase`
events but **plain integers** for `fish` events, a latent bug waiting for any
cross-type query. Now stores **wei everywhere**:
- `api/fish/sell.ts`: `fishValueWei = BigInt(fishValue) * 10**18`
- Rolling cap: `ROLLING_CAP_WEI = 1000 * 10**18` (1000 $OP/hr)
- `api/economy/rewards/[address].ts`: fishing query reads wei directly, no more `* 10**18` at display time
- `api/economy/sign-fishing-claim.ts`: no sign-time conversion (pass through wei)
- `api/fish/state/[address].ts`: returns both wei (`unclaimedFishingOP`) and formatted string (`unclaimedFishingFormatted`)

### Vite dev middleware mirrors production
Previously `/api/economy/sign-trading-claim` in `vite.config.ts` was a dummy
returning an all-zero signature, and `/api/fish/sell` hardcoded `opEarned: 10`
without touching `economy_events`. Both now mirror the real Vercel handlers:
- Real EIP-712 signing against `TEST_REWARDS_CLAIMER_CONTRACT` via viem
- Real rolling-cap sell flow with wei insert into `economy_events`
- On-chain nonce reads for both trading and fishing from the testnet claimer

---

## Phase 4 Validation — PASSED

**Testnet claim tx:** `0x0052b6941142b87ffda9fc5bf229fc71f4149755226fef801a5e014d0e586496`
**Block:** 12971387 on Tempo Moderato Testnet
**Gas used:** 551,710
**Date:** 2026-04-14

### What was verified
The full round trip was executed atomically via `scratch/e2e_testnet_claim.ts`:

1. Inserted 1 $OP (1e18 wei) unclaimed `fish` row in `economy_events` for `0x7831...`
2. Read on-chain `fishingNonces(0x7831...)` → 0 (pre-claim)
3. Called `signFishingClaim()` from the real `api/_signer.ts` backend module
4. Signature recovered correctly on-chain (no `InvalidSignature` revert)
5. `RewardsClaimer.claimFishingRewards(1e18, 0, sig)` → tx succeeded
6. Test $OP balance increased by exactly 1e18 (0 → 1e18)
7. `fishingNonces` incremented (0 → 1)
8. `economy_events.claimed` flipped to TRUE with `claim_tx_hash` set

Independently re-verified via `cast`:
```
$ cast call 0xb2877314D63dF74FF66dcdE91B6afe7D36AFa687 "fishingNonces(address)(uint256)" 0x7831... --rpc-url https://rpc.moderato.tempo.xyz
1
$ cast call 0xe5a7d520fbeBAaADb60cB80FD31ffb74f564d15d "balanceOf(address)(uint256)" 0x7831... --rpc-url https://rpc.moderato.tempo.xyz
1000000000000000000
```

**This is the single de-risking step from the homestretch plan.** viem's
`signTypedData` output matches what OpenZeppelin's `EIP712._hashTypedDataV4` +
`ECDSA.recover` will accept on the mainnet contract, because:
- `eip712Domain()` returns identical shape on both testnet and mainnet
  (name=`WhaleTownRewards`, version=`1`, verifyingContract=self)
- The only differing field is `chainId`, which is correctly derived from
  `block.chainid` on-chain and from `process.env.CHAIN_ID` via `_env.ts` off-chain
- The contract code is byte-identical across both deployments

**Trading claim signature path** has not been exercised on testnet because
the testnet has no marketplace contract and no sales to reward. It uses the
same signer with a different typehash (`TradingClaim` vs `FishingClaim`),
same domain, same recovery path — so the cryptographic validity transfers.

---

## Configuration

### Root `.env`
All present:
- `REWARDS_SIGNER_PRIVATE_KEY` — the `0x7831...` ops wallet key (0x-prefixed)
- `REWARDS_CLAIMER_CONTRACT` — mainnet RewardsClaimer
- `TEST_REWARDS_CLAIMER_CONTRACT` — testnet RewardsClaimer
- `TREASURY_WALLET` / `TEST_TREASURY_WALLET` — both set to `0x7831...`
- `RPC_URL` / `CHAIN_ID` — mainnet defaults
- `TEST_RPC_URL` / `TEST_CHAIN_ID` — testnet defaults
- `POSTGRES_URL` — Render DB
- `ENVIRONMENT` — currently `development` for local testing

### Vercel (Production)
NOT YET CONFIGURED. Must be added before Phase 8 smoke test. Add to both
Production and Preview scopes:
- `REWARDS_CLAIMER_CONTRACT=0xfEAA26Fff4687028dDbb8904c3c7ceFe4abc0817`
- `REWARDS_SIGNER_PRIVATE_KEY=<0x7831 key>`
- `TREASURY_WALLET=0x7831959816fAA58B5Dc869b7692cebdb6EFC311E`

---

## Remaining Tasks

### Phase 8: Vercel env + preview smoke test
1. Add the three env vars above to Vercel Production + Preview.
2. Push main → Vercel rebuilds.
3. Open preview URL, connect a wallet with 1-2 real past sales.
4. Verify `/api/economy/rewards/<wallet>` returns correct unclaimed $OP amount.
5. **Do not click Claim yet** — this is a read-only smoke test.

### Phase 9: First mainnet claim
1. Pick a test wallet with exactly 1 small-value past sale:
   ```sql
   SELECT buyer, price FROM sales ORDER BY price ASC LIMIT 5;
   ```
2. Connect that wallet, click Claim in the Rewards tab.
3. Verify: mainnet tx succeeds, correct $OP amount minted, `economy_events` row updated, `tradingNonces` incremented.

### Phase 10: Promote to production fork
Cherry-pick or merge main → production fork. Set identical env vars on
production Vercel. Redo the small-sale smoke test on production URL.

### Phase 11: Fish game activation (deferred)
Fish game has more code paths (cast RNG, sell, tackle box, journal, rolling
cap). Will need its own validation pass after trading rewards are stable.
Phase 4 already proved the fishing claim signature flow works.

---

## Technical Debt / Notes

- **Pre-existing TypeScript errors** in viem `readContract` type narrowing
  (`authorizationList missing`) affect multiple API files including
  `api/admin/index-whales.ts`. These are cosmetic — they don't affect
  runtime and `vite build` still succeeds. Unrelated to economy work.
- **`api/fish/buy-tackle-box.ts` uses untyped log `.topics` access**
  because the Transfer event isn't in the ABI. Pre-existing in the
  committed version. Same cosmetic-only classification.
- **Migration runner footgun**: `api/migrations/run.ts` starts migration
  001 with a `DROP TABLE IF EXISTS economy_events CASCADE`. Use
  `scratch/apply_migrations_002_003.ts` for safe idempotent reapplies.
- **Foundry deploy artifact**: `contracts/broadcast/DeployRewardsClaimer.s.sol/42431/`
  references a never-mined address. Safe to delete.
- **Parallel session awareness**: if another whale-town session is running
  vite or the migration runner concurrently, the schema state can race.
  Keep one session touching the DB at a time.
