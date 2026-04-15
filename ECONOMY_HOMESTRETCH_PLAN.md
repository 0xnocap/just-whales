# Whale Town Economy — Homestretch Plan

**Created:** 2026-04-14
**Goal:** Get from "code written" to "trading rewards live on mainnet" with maximum confidence and minimum risk.
**Strategy:** Validate the viem ↔ Solidity EIP-712 signature round trip on testnet first. If that passes, mainnet is just env vars.

---

## Current State (as of commit `aab4072`)

All economy code is committed to `main`:
- `RewardsClaimer.sol` + 8 passing Foundry tests
- `api/_signer.ts` + trading/fishing/confirm claim endpoints
- Server-side fish game (`cast`, `sell`, `buy-tackle-box`, `state`)
- Frontend hooks + Profile Rewards tab + Fish page wallet gating
- Vite dev middleware covering all new endpoints
- Bug fixes applied: treasury wallet, wei conversion, claimed flag, no-bite counting

**What's NOT done:** contract not deployed, env vars not set, no end-to-end signature test.

---

## Gotchas Identified

These need to be addressed BEFORE running any deploy:

1. **`api/_signer.ts` hardcodes `chainId: 4217`** — will produce invalid signatures on testnet (chain 42431). Must make env-driven.
2. **`api/economy/rewards/[address].ts` hardcodes `TEMPO_RPC = 'https://rpc.tempo.xyz'`** — same issue. Also hardcoded in `sign-trading-claim.ts`, `sign-fishing-claim.ts`, and `buy-tackle-box.ts`.
3. **Deploy script calls `points.grantRole(MINTER_ROLE, claimer)`** — requires the deployer wallet (`0x7831...`) to hold `DEFAULT_ADMIN_ROLE` on the points contract. Per the savepoint, `0x7831...` has `MINTER_ROLE` on mainnet $OP, which is NOT the same as admin. If admin role is missing, the script will revert mid-deploy. Verify before running.

---

## Phase 0: Pre-flight Verification (5 min)

Confirm all prerequisites before touching the deploy script.

- [ ] **Verify admin role on testnet $OP.** Read `hasRole(DEFAULT_ADMIN_ROLE, 0x7831...)` on `TEST_POINTS_CONTRACT` (`0xe5a7d520fbeBAaADb60cB80FD31ffb74f564d15d`).
  ```bash
  cast call 0xe5a7d520fbeBAaADb60cB80FD31ffb74f564d15d \
    "hasRole(bytes32,address)(bool)" \
    0x0000000000000000000000000000000000000000000000000000000000000000 \
    0x7831959816fAA58B5Dc869b7692cebdb6EFC311E \
    --rpc-url https://rpc.moderato.tempo.xyz
  ```
  - If `false`: grant admin role from whoever deployed the test points contract, OR split the deploy script (deploy only, then grant role separately from the admin wallet).
- [ ] **Verify admin role on mainnet $OP.** Same call against `0xCf4A2079A2c058d266A0999F3fCA256d6F1F53a9` + `https://rpc.tempo.xyz`.
- [ ] **Confirm `contracts/.env` has `PRIVATE_KEY`** set to the `0x7831...` ops wallet key.
- [ ] **Confirm testnet $OP uses OpenZeppelin AccessControl** with the same `MINTER_ROLE` constant as mainnet (deploy script assumes it).

---

## Phase 1: Make Signer + Endpoints Env-Aware (15 min)

Refactor so switching test/prod is a single env flag. No point deploying anything until this is done.

- [ ] `api/_signer.ts`:
  - Read `chainId` from `process.env.CHAIN_ID` (default `4217`).
  - Keep `verifyingContract` reading from `REWARDS_CLAIMER_CONTRACT`.
- [ ] `api/economy/rewards/[address].ts`:
  - Replace hardcoded `TEMPO_RPC` with `process.env.RPC_URL`.
  - Read `chainId` from env.
- [ ] `api/economy/sign-trading-claim.ts`: same RPC + chainId refactor.
- [ ] `api/economy/sign-fishing-claim.ts`: same RPC + chainId refactor.
- [ ] `api/fish/buy-tackle-box.ts`: uses an RPC to verify on-chain transfer — same refactor.
- [ ] `.env`: add the following (TEST_ values first, leave blank where TBD):
  ```
  REWARDS_SIGNER_PRIVATE_KEY=<0x7831 key from contracts/.env>
  TEST_REWARDS_CLAIMER_CONTRACT=
  TEST_TREASURY_WALLET=0x7831959816fAA58B5Dc869b7692cebdb6EFC311E
  REWARDS_CLAIMER_CONTRACT=
  TREASURY_WALLET=0x7831959816fAA58B5Dc869b7692cebdb6EFC311E
  ```
- [ ] `vite.config.ts`: wire `REWARDS_CLAIMER_CONTRACT` + `TREASURY_WALLET` into the dev/prod environment switch. Mirror the existing `POINTS_CONTRACT` pattern — use `TEST_` prefix when `ENVIRONMENT=development`.

**Commit:** `fix(economy): make rewards endpoints env-aware for testnet/mainnet switch`

---

## Phase 2: Deploy RewardsClaimer to Tempo Testnet (5 min)

```bash
cd contracts
source .env   # loads PRIVATE_KEY
forge script script/DeployRewardsClaimer.s.sol \
  --rpc-url tempo_testnet --broadcast --slow \
  --private-key 0x$PRIVATE_KEY \
  --sig "run(address,address,address)" \
  0x7831959816fAA58B5Dc869b7692cebdb6EFC311E \
  0xe5a7d520fbeBAaADb60cB80FD31ffb74f564d15d \
  0x7831959816fAA58B5Dc869b7692cebdb6EFC311E
```

- [ ] Capture deployed address from broadcast logs.
- [ ] Write address to `TEST_REWARDS_CLAIMER_CONTRACT` in `.env`.
- [ ] Verify on testnet explorer: contract exists, `authorizedSigner() == 0x7831...`, `points() == TEST_POINTS_CONTRACT`.
- [ ] Verify `RewardsClaimer` has `MINTER_ROLE` on TEST_POINTS_CONTRACT:
  ```bash
  cast call 0xe5a7d520fbeBAaADb60cB80FD31ffb74f564d15d \
    "hasRole(bytes32,address)(bool)" \
    $(cast keccak "MINTER_ROLE") \
    <new_claimer_address> \
    --rpc-url https://rpc.moderato.tempo.xyz
  ```

---

## Phase 3: Seed a Test Fishing Reward (2 min)

Trading rewards can't test on testnet (no marketplace, no sales). Fishing is our round-trip test.

- [ ] Pick a test wallet you control (a burner with some testnet gas).
- [ ] Insert one row via `psql` or a `scratch/` script:
  ```sql
  INSERT INTO economy_events (wallet, event_type, source_id, points_awarded, claimed)
  VALUES ('<test_wallet_lowercase>', 'fish', 999999, 50, FALSE);
  ```

---

## Phase 4: Run Claim Round-Trip Locally Against Testnet (10 min)

**This is the de-risking step. Everything downstream depends on this passing.**

- [ ] Set `ENVIRONMENT=development` in `.env`.
- [ ] `npm run dev` — vite picks up TEST_ contracts and testnet RPC.
- [ ] Connect test wallet in browser (switched to Tempo testnet).
- [ ] Go to Profile → Rewards tab. Should see `50 $OP` unclaimed fishing.
- [ ] Click Claim. Frontend flow:
  1. POST `/api/economy/sign-fishing-claim` → server returns `{amount: 50e18 wei, nonce: 0, signature}`
  2. Wagmi sends `RewardsClaimer.claimFishingRewards(amount, 0, sig)` to testnet
  3. Tx succeeds → 50 $OP minted to test wallet
  4. Frontend POSTs `/api/economy/confirm-claim` → `economy_events.claimed` flips to TRUE

**Pass criteria:**
- [ ] Testnet tx succeeds (no `InvalidSignature` revert = viem ↔ OZ EIP-712 agreement confirmed)
- [ ] Test wallet balance increases by `50e18` on TEST_POINTS_CONTRACT
- [ ] DB row shows `claimed = TRUE` + `claim_tx_hash` populated
- [ ] Nonce on-chain increments to 1
- [ ] A second claim attempt correctly shows 0 unclaimed

**If it fails (debug playbook):**
- **Most likely cause:** domain separator mismatch. The `chainId` in the signed message must match `block.chainid` at the contract address.
- **Second most likely:** `verifyingContract` in the signed domain doesn't match the deployed `REWARDS_CLAIMER_CONTRACT` address.
- **Debug command:**
  ```bash
  cast call $REWARDS_CLAIMER "DOMAIN_SEPARATOR()(bytes32)" --rpc-url https://rpc.moderato.tempo.xyz
  ```
  Compare against what viem produces via `hashDomain({ name: 'WhaleTownRewards', version: '1', chainId: 42431, verifyingContract: $REWARDS_CLAIMER })`.
- **Third possibility:** the `MINTER_ROLE` grant failed silently in Phase 2 — re-run the verification cast call.

---

## Phase 5: Trading Claim Signature Sanity Check (5 min)

We can't test trading end-to-end on testnet (no sales), but we can validate the signature path.

**Option A (quick):** After Phase 4 passes, skip. Same signer, same contract, different type hash — high confidence.

**Option B (thorough):** Write a one-off script in `scratch/` that:
1. Calls `signTradingClaim(testWallet, 10e18, 0)`.
2. Logs the signature.
3. Uses viem's `recoverTypedDataAddress` locally to verify it recovers to `0x7831...`.
4. Compares `hashDomain` output against `cast call $CLAIMER "DOMAIN_SEPARATOR()"`.

**Decision:** Option A unless Phase 4 uncovers anything weird.

---

## Phase 6: Update Execution Plan Doc (5 min)

- [ ] Mark Phases 1-2 of `ECONOMY_EXECUTION_PLAN.md` as COMPLETED with the testnet deploy address.
- [ ] Add a "Testnet Validation" section capturing the claim tx hash as proof the signature flow works end-to-end.
- [ ] Delete or archive `CLAUDE_SAVEPOINT.md` (session note, no longer needed).

**Commit:** `docs(economy): record testnet deploy + claim validation`

---

## Phase 7: Mainnet Deploy (10 min)

**Only proceed if Phase 4 passed.**

- [ ] Re-verify `0x7831...` has `DEFAULT_ADMIN_ROLE` on mainnet $OP (from Phase 0). If false, coordinate with admin wallet holder BEFORE running the script.
- [ ] Run deploy script against mainnet:
  ```bash
  cd contracts
  source .env
  forge script script/DeployRewardsClaimer.s.sol \
    --rpc-url tempo --broadcast --slow \
    --private-key 0x$PRIVATE_KEY \
    --sig "run(address,address,address)" \
    0x7831959816fAA58B5Dc869b7692cebdb6EFC311E \
    0xCf4A2079A2c058d266A0999F3fCA256d6F1F53a9 \
    0x7831959816fAA58B5Dc869b7692cebdb6EFC311E
  ```
- [ ] Capture mainnet `RewardsClaimer` address from broadcast logs.
- [ ] **Fallback if admin role grant fails:** deploy RewardsClaimer only (comment out the `grantRole` line in the script, redeploy), then separately have whoever holds `DEFAULT_ADMIN_ROLE` on mainnet $OP run `$OP.grantRole(MINTER_ROLE, claimer)`.
- [ ] Verify on mainnet explorer: contract code matches, roles correct.

---

## Phase 8: Vercel Env + Promote to Preview (5 min)

- [ ] Add to Vercel production env (and local `.env` too):
  ```
  REWARDS_CLAIMER_CONTRACT=<mainnet address>
  REWARDS_SIGNER_PRIVATE_KEY=<0x7831 key>
  TREASURY_WALLET=0x7831959816fAA58B5Dc869b7692cebdb6EFC311E
  ```
- [ ] Push main (already pushed from commits). Vercel rebuilds.
- [ ] Open Vercel preview URL.
- [ ] **Smoke test (read-only):** connect a wallet with 1-2 real past sales. Go to Profile → Rewards. Verify unclaimed $OP amount looks correct. **Do NOT click claim yet.**

---

## Phase 9: First Mainnet Claim — The Moment of Truth (5 min)

- [ ] Pick a test wallet that has exactly 1 past sale (query `sales` table for a small price to minimize risk):
  ```sql
  SELECT buyer, price FROM sales ORDER BY price ASC LIMIT 5;
  ```
- [ ] Connect that wallet in browser on preview URL.
- [ ] Click Claim in Rewards tab.
- [ ] Verify on mainnet explorer: tx succeeds, correct $OP amount minted to wallet.
- [ ] Verify DB: `economy_events` row has `claimed = TRUE` + `claim_tx_hash` set.
- [ ] Verify on-chain: `tradingNonces[wallet] == 1`.

**If this passes:** trading rewards are live for all 848 sales on preprod main.

**If it fails:** investigate BEFORE touching production. Most likely culprits at this stage are env var mismatch (wrong chainId, wrong contract address in signer) — the cryptography itself is already validated from Phase 4.

---

## Phase 10: Merge to Production Fork (whenever ready)

- [ ] Cherry-pick or merge main → production fork repo.
- [ ] Set same env vars on production Vercel project.
- [ ] Deploy production.
- [ ] Do a second smoke test on production with the same small-sale test wallet.
- [ ] Announce trading rewards live.

---

## Phase 11: Fish Game Activation (separate task)

Fish game has more code paths (cast RNG, sell, tackle box, journal, rolling cap) and deserves its own round-trip validation. Deferred until trading rewards are stable.

Key validation points when the time comes:
- [ ] Server-side cast RNG produces catches in correct rarity distribution
- [ ] No-bite casts decrement the daily counter
- [ ] `sell.ts` rolling cap math is correct (1000 $OP/hr)
- [ ] Tackle box tx verification works (on-chain `transfer` call check)
- [ ] Fish claim round-trip (already validated in Phase 4 via seeded reward)

---

## Critical Ordering

**Do not skip phases 0-4.** They are the de-risking path.

- **Phase 0** catches the "who's admin" problem before it wastes a deploy tx.
- **Phase 1** catches the "wrong chainId in signature" bug before it causes confusing on-chain reverts.
- **Phase 4** is the one-shot validation that proves viem signatures match OpenZeppelin's EIP712 implementation.

If Phase 4 passes, Phases 7-10 are just env vars and smoke tests.
If Phase 4 fails, no amount of mainnet prep helps — fix the signing domain first.

---

## Time Estimate

| Phase | Time | Notes |
|---|---|---|
| 0 | 5 min | Pre-flight |
| 1 | 15 min | Env-aware refactor |
| 2 | 5 min | Testnet deploy |
| 3 | 2 min | Seed reward |
| 4 | 10 min | **Critical validation** |
| 5 | 0-5 min | Skip if Phase 4 passes |
| 6 | 5 min | Doc update |
| 7 | 10 min | Mainnet deploy |
| 8 | 5 min | Vercel env |
| 9 | 5 min | First mainnet claim |
| 10 | 10 min | Merge to prod |

**Total: ~75 min** if nothing goes sideways, **2-3 hours** with one debugging cycle on Phase 4.

---

## Rollback Plan

If something goes wrong mid-mainnet deploy:
- **Contract deployed but role grant failed:** the contract is harmless without `MINTER_ROLE`. Leave it, coordinate role grant separately.
- **Contract + role OK but signature verification fails in production:** remove `REWARDS_CLAIMER_CONTRACT` from Vercel env. The Rewards tab will throw a caught error and show 0 rewards instead of claiming against a broken config.
- **First claim succeeds but mints wrong amount:** the bug is in the math in `sign-trading-claim.ts` (`price * 10^13`). Nonce already incremented, so that sale is burned for that wallet — but subsequent sales still work. Not catastrophic.
- **Compromised signer key:** call `setSigner(newSigner)` from the admin wallet, all old signatures become invalid.

---

## Open Questions

- [ ] Does `0x7831...` actually have `DEFAULT_ADMIN_ROLE` on mainnet $OP? (Phase 0 check)
- [ ] Does the test $OP contract use the same OZ AccessControl + MINTER_ROLE ABI? (Phase 0 check)
- [ ] What's the actual balance of gas on the `0x7831...` wallet on both chains? (check before deploy)
- [ ] Is the Vercel project linked to main branch auto-deploy, or is a manual promote needed? (check before Phase 8)
