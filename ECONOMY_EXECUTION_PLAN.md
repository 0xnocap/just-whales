# Whale Town Economy Execution Plan

**Created:** 2026-04-14
**Status:** Ready to build

---

## Current State

What's live and working:

| Component | Status | Details |
|---|---|---|
| $OP Token (ERC-20) | Deployed mainnet | `0xCf4A2079A2c058d266A0999F3fCA256d6F1F53a9` - 18 decimals, MINTER_ROLE-gated |
| WhaleTownStaking | Deployed mainnet | `0x650F7fd9084b8631e16780A90BBed731679598F0` - has MINTER_ROLE, per-token rates |
| NFT Contract | Deployed mainnet | `0x1065ef5996C86C8C90D97974F3c9E5234416839F` - 3,333 supply |
| Marketplace | Deployed mainnet | `0x26CC31587Faa3334e7bbfC9A2255E1c1434fDbBe` - pathUSD payments |
| Staking UI | Live | Stake/unstake/claim all working. Users claim $OP on-chain. |
| Goldsky Indexer | Live | Populates: transfers (7,186), sales (848), listed (1,679), canceled (546) |
| DB Economy Tables | Created but empty | users, purchases, economy_events, game_events, inventory, redemptions, staking_positions |
| reward_rates | Seeded | 11 rows: 6 body rates, 4 trait bonuses, 1 rolling cap |
| Fish Game UI | Playable | Fully client-side/localStorage. No wallet, no API, no rewards. |

What needs building:

1. **RewardsClaimer contract** - signature-based claim for trading + fishing rewards
2. **Trading rewards** - $1 pathUSD spent = 10 $OP, claimable
3. **Fish game backend** - server-side sessions, RNG, reward tracking
4. **Fish game wallet wiring** - $OP spending (Tackle Box) and earning (selling fish, claiming)

---

## Architecture

### Reward Flows

```
STAKING (already live):
  User -> StakingContract.claim() -> $OP.mintTo(user)
  Fully on-chain. No backend.

TRADING REWARDS (to build):
  Goldsky indexes sale -> sales table has price+buyer
  User clicks "Claim Trading Rewards" in UI
  Frontend -> GET /api/economy/rewards/:address (calculates unclaimed)
  Frontend -> POST /api/economy/sign-trading-claim (backend signs EIP-712)
  Frontend -> RewardsClaimer.claimTradingRewards(amount, nonce, signature)
  Contract verifies signature -> $OP.mintTo(user)

FISHING REWARDS (to build):
  User plays fish game
  Frontend -> POST /api/fish/cast (server rolls RNG, returns catch)
  User sells fish -> POST /api/fish/sell (accrues $OP in DB)
  User clicks "Claim Fishing Rewards"
  Frontend -> POST /api/economy/sign-fishing-claim (backend signs EIP-712)
  Frontend -> RewardsClaimer.claimFishingRewards(amount, nonce, signature)
  Contract verifies signature -> $OP.mintTo(user)

TACKLE BOX PURCHASE (to build):
  User clicks "Buy Tackle Box" (100 $OP)
  Frontend -> $OP.transfer(treasuryWallet, 100e18) on-chain
  Frontend -> POST /api/fish/buy-tackle-box { txHash }
  Backend verifies transfer on-chain -> grants +10 casts
```

### Trust Model

- **Signer wallet** (`0x7831...` EOA): Signs EIP-712 authorization messages. Private key in backend env var. Never sends transactions.
- **RewardsClaimer contract**: Holds MINTER_ROLE on $OP. Verifies signatures from the authorized signer. Mints $OP when users claim with valid signatures.
- **Users**: Pay their own gas to claim. Same UX as staking claims.
- **Nonce tracking**: Contract tracks per-wallet nonces. Each signed claim can only be used once.

---

## Phase 1: RewardsClaimer Contract

### 1.1 Contract: `RewardsClaimer.sol`

Deploy a new contract that handles both trading and fishing reward claims via EIP-712 signatures.

**Constructor args:**
- `address admin` - DEFAULT_ADMIN_ROLE holder
- `address signer` - the `0x7831...` wallet that signs claim authorizations
- `address pointsToken` - $OP contract address

**State:**
- `mapping(address => uint256) public tradingNonces` - prevents replay on trading claims
- `mapping(address => uint256) public fishingNonces` - prevents replay on fishing claims
- `address public authorizedSigner` - the backend signing wallet
- `IMintablePoints public points` - the $OP token

**Functions:**
```
claimTradingRewards(uint256 amount, uint256 nonce, bytes signature)
  - Verify nonce matches tradingNonces[msg.sender]
  - Recover signer from EIP-712 signature of (wallet, amount, nonce, "trading")
  - Require recovered == authorizedSigner
  - Increment tradingNonces[msg.sender]
  - Call points.mintTo(msg.sender, amount)
  - Emit TradingRewardsClaimed(msg.sender, amount, nonce)

claimFishingRewards(uint256 amount, uint256 nonce, bytes signature)
  - Same pattern with fishingNonces and domain separator "fishing"
  - Emit FishingRewardsClaimed(msg.sender, amount, nonce)

setSigner(address newSigner) - onlyRole(DEFAULT_ADMIN_ROLE)
```

**EIP-712 domain:**
```
name: "WhaleTownRewards"
version: "1"
chainId: 4217
verifyingContract: <RewardsClaimer address>
```

**EIP-712 types:**
```
TradingClaim { address wallet, uint256 amount, uint256 nonce }
FishingClaim { address wallet, uint256 amount, uint256 nonce }
```

### 1.2 Foundry Tests

Test cases:
- Valid trading claim mints correct amount
- Valid fishing claim mints correct amount
- Replayed nonce reverts
- Wrong signer reverts
- Correct nonce increments after claim
- setSigner updates signer and new signatures work
- Batch scenario: multiple users claiming in same block
- Fuzz: random amounts and nonces

### 1.3 Deploy Steps

1. Deploy RewardsClaimer: `new RewardsClaimer(admin, signer_0x7831, OP_address)`
2. Grant MINTER_ROLE on $OP to RewardsClaimer: `$OP.grantRole(MINTER_ROLE, rewardsClaimerAddress)`
3. Verify on block explorer
4. Add `REWARDS_CLAIMER_CONTRACT` to `.env`
5. Add ABI + address to `contract.js`

---

## Phase 2: Trading Rewards Backend

**Rule: Every $1.00 pathUSD spent buying NFTs = 10 $OP**

pathUSD has 6 decimals. So: `$OP_due = (price / 1e6) * 10 * 1e18`
Simplified: `$OP_due = price * 10 * 1e12`

### 2.1 API: `GET /api/economy/rewards/:address`

Returns the user's unclaimed rewards summary.

```ts
{
  trading: {
    totalPurchases: 12,          // total sales where buyer = address
    claimedPurchases: 8,         // already claimed
    unclaimedOP: "5000000...",   // wei string, unclaimed $OP
    unclaimedFormatted: "50.00"  // human-readable
  },
  fishing: {
    unclaimedOP: "200000...",
    unclaimedFormatted: "2.00"
  },
  nonces: {
    trading: 3,                  // current on-chain nonce (for signing)
    fishing: 1
  }
}
```

**Logic:**
1. Query Goldsky `sales` table: all rows where `LOWER(buyer) = $address`
2. Query `economy_events` table: all rows where `wallet = $address AND event_type = 'purchase'`
3. Diff: unclaimed = sales not yet recorded in economy_events (match by `transaction_hash`)
4. Calculate $OP: sum of unclaimed sale prices, apply rate (price / 1e6 * 10)
5. Query `economy_events` for `event_type = 'fish'` to get unclaimed fishing rewards
6. Read on-chain nonces from RewardsClaimer contract

### 2.2 API: `POST /api/economy/sign-trading-claim`

Backend signs an EIP-712 message authorizing the user to claim their trading rewards.

**Request:** `{ address: "0x..." }`

**Logic:**
1. Calculate unclaimed trading $OP (same as rewards endpoint)
2. If amount == 0, return error
3. Read current `tradingNonces[address]` from RewardsClaimer contract
4. Sign EIP-712 typed data: `TradingClaim { wallet: address, amount: opWei, nonce: currentNonce }`
5. Sign with `REWARDS_SIGNER_PRIVATE_KEY` env var (the `0x7831...` wallet)
6. Record in `economy_events`: one row per sale being claimed, `event_type = 'purchase'`
7. Upsert `users` row: update `points_balance`, `lifetime_points`

**Response:**
```ts
{
  amount: "50000000000000000000",  // wei
  nonce: 3,
  signature: "0x...",
  salesClaimed: 4                  // number of sales included
}
```

Frontend then calls `RewardsClaimer.claimTradingRewards(amount, nonce, signature)`.

### 2.3 Server-side Signing Utility

Create `api/_signer.ts`:
- Loads `REWARDS_SIGNER_PRIVATE_KEY` from env
- Creates a viem `Account` from the private key
- Exports `signTradingClaim(wallet, amount, nonce)` and `signFishingClaim(wallet, amount, nonce)`
- Uses viem's `signTypedData` with the EIP-712 domain and types matching the contract

### 2.4 Environment Variables

Add to `.env` and Vercel:
```
REWARDS_SIGNER_PRIVATE_KEY=<private key for 0x7831...>
REWARDS_CLAIMER_CONTRACT=<deployed address>
TREASURY_WALLET=<address to receive $OP for tackle box purchases>
```

---

## Phase 3: Trading Rewards Frontend

### 3.1 Add Contract Config

Add to `contract.js`:
- `REWARDS_CLAIMER_ADDRESS`
- `REWARDS_CLAIMER_ABI` (claimTradingRewards, claimFishingRewards, tradingNonces, fishingNonces)

### 3.2 Rewards Hook: `useRewards.ts`

```ts
function useRewards(address) {
  // Fetches /api/economy/rewards/:address on mount + poll
  // Returns: tradingRewards, fishingRewards, loading, refetch
  // claimTrading(): POST sign-trading-claim -> send tx to RewardsClaimer
  // claimFishing(): POST sign-fishing-claim -> send tx to RewardsClaimer
}
```

### 3.3 UI Integration

**Option A - Profile page rewards section:**
- New "Rewards" tab on ProfilePage alongside Collected/Listed/Activity
- Shows unclaimed trading $OP with "Claim" button
- Shows unclaimed fishing $OP with "Claim" button
- Transaction status/confirmation

**Option B - Header widget:**
- Small rewards indicator in the nav bar (like the $OP balance display)
- Click expands a dropdown showing unclaimed amounts + claim buttons

**Recommendation:** Both. Header shows the number, profile page has the full breakdown.

### 3.4 Post-Buy Notification

After a successful NFT purchase in TokenModal:
- Show a toast: "You earned X $OP from this purchase! Claim on your profile."
- This is cosmetic only; the actual reward is calculated from the Goldsky sales data.

---

## Phase 4: Fish Game Backend

### 4.1 Server-Side Game State

Move the source of truth from localStorage to the database. The client becomes a thin rendering layer.

**New table or extend existing:** Use `game_events` for catch records. Track session state in a lightweight way:

**Session state (in-memory or short-lived DB):**
```ts
{
  wallet: "0x...",
  date: "2026-04-14",
  castsRemaining: 5,           // resets daily
  tackleBoxPurchased: false,   // resets daily
  // No need to persist between server restarts - just re-derive from game_events
}
```

On session start, derive remaining casts from:
- `FREE_DAILY_ATTEMPTS (5)` minus today's `game_events` count for this wallet
- Plus 10 if tackle box was purchased today (check on-chain transfer or DB flag)

### 4.2 API: `POST /api/fish/cast`

The core gameplay endpoint. Server does the RNG, not the client.

**Request:** `{ address: "0x..." }` (or derive from signed auth)

**Logic:**
1. Verify wallet (signature check or session token)
2. Count today's casts from `game_events` for this wallet
3. Check remaining attempts (5 free + 10 if tackle box purchased)
4. If no attempts left, return error
5. **Server-side RNG** (same probability table as current client):
   - 50% no bite -> return `{ result: "no_bite", message: "<random funny message>" }`
   - 50% bite -> roll rarity table -> pick random fish from that rarity
6. Record in `game_events`: `{ wallet, game: 'fish', result: { fishId, rarity, value }, points_earned: <fish value>, prize_tier: <if NFT> }`
7. Return: `{ result: "catch", fish: { id, name, rarity, value, icon, color, nftTier? } }`

**Rate limiting:** Max 1 cast per 5 seconds per wallet (prevents scripting).

### 4.3 API: `POST /api/fish/sell`

User sells a caught fish for $OP (added to claimable balance).

**Request:** `{ address: "0x...", gameEventId: 123 }`

**Logic:**
1. Verify the game_event belongs to this wallet and hasn't been sold/redeemed
2. Look up fish value from the game_event result
3. **Apply 1000 $OP/hr rolling cap** (fishing only):
   - Query `economy_events` for this wallet, `event_type = 'fish'`, last 60 minutes
   - Sum `points_awarded`
   - If sum + fish_value > 1000, cap at remaining capacity. Log overflow.
4. Record in `economy_events`: `{ wallet, event_type: 'fish', source_id: gameEventId, points_awarded: cappedValue }`
5. Mark `game_events` row: `redeemed = true`
6. Return: `{ sold: true, opEarned: cappedValue, capRemaining: ... }`

### 4.4 API: `POST /api/fish/buy-tackle-box`

User buys +10 casts by transferring 100 $OP on-chain.

**Request:** `{ address: "0x...", txHash: "0x..." }`

**Logic:**
1. Check this wallet hasn't purchased a tackle box today (query `game_events` or a flag)
2. Verify the transaction on-chain via RPC:
   - Confirm it's a `transfer(treasury, 100e18)` call on the $OP contract
   - Confirm `from` matches the requesting address
   - Confirm the tx is confirmed (not pending)
3. Record the purchase (so it can't be replayed)
4. Return: `{ success: true, castsGranted: 10 }`

### 4.5 API: `GET /api/fish/state/:address`

Returns current fish game state for a wallet.

**Response:**
```ts
{
  castsRemaining: 3,
  tackleBoxPurchased: false,
  inventory: [                        // unclaimed catches from today
    { gameEventId: 123, fish: { id: "octopus", name: "Octopus", ... }, soldOrClaimed: false },
    ...
  ],
  discoveredFishIds: ["clownfish", "octopus", ...],   // lifetime journal
  unclaimedFishingOP: "200000..."                      // pending $OP from sold fish
}
```

### 4.6 API: `POST /api/economy/sign-fishing-claim`

Same pattern as trading claims. Backend signs EIP-712 message for unclaimed fishing $OP.

**Logic:**
1. Sum unclaimed fishing rewards from `economy_events` where `event_type = 'fish'` and not yet claimed on-chain
2. Sign `FishingClaim { wallet, amount, nonce }`
3. Mark those economy_events as claimed
4. Return signature for on-chain claim

---

## Phase 5: Fish Game Frontend Wiring

### 5.1 Replace localStorage with Server State

**Current:** `useFishGameState.ts` manages everything in localStorage.
**New:** Hook calls server APIs. localStorage becomes a cache/fallback only.

```ts
// New hook: useFishGameServer.ts
function useFishGameServer(address) {
  // On mount: GET /api/fish/state/:address
  // cast(): POST /api/fish/cast -> returns catch result
  // sell(gameEventId): POST /api/fish/sell -> returns $OP earned
  // buyTackleBox(txHash): POST /api/fish/buy-tackle-box
  // Polling: refresh state every 30s or after actions
}
```

### 5.2 Wire Wallet into FishPage

- Import `useAccount` from wagmi
- If not connected, show "Connect Wallet to Play" overlay
- Pass `address` to the server hook
- Show $OP balance in the header stats (replace "coins" with actual $OP)

### 5.3 Update GameScene

- `handleCast()` calls server `cast()` instead of local RNG
- Server returns the catch result; client just animates it
- Remove client-side `resolveCatch()` function
- Keep all animations/timing as-is (cast -> wait -> bite -> result)

### 5.4 Update Net Tab

- Fish inventory comes from server state, not localStorage
- "Sell" button calls `POST /api/fish/sell` -> shows $OP earned toast
- "Claim" button on NFT fish -> placeholder for Phase 6 (NFT prize claiming)
- Show rolling cap status: "Fishing Rewards: 450/1000 $OP this hour"

### 5.5 Update Market Tab

- Rename "Supply Pack" to "Tackle Box" everywhere
- "Buy Tackle Box" flow:
  1. Check $OP allowance (not needed - using transfer, not approve)
  2. Call `$OP.transfer(treasuryWallet, 100e18)` via wagmi
  3. Wait for tx confirmation
  4. Call `POST /api/fish/buy-tackle-box { txHash }`
  5. UI updates: +10 casts, button disabled for today

### 5.6 Journal Tab

- `discoveredFishIds` comes from server (`GET /api/fish/state`)
- Persists across days (lifetime discovery log)
- No changes to rendering, just data source

---

## Phase 6: NFT Prize Claiming (Future)

Not in immediate scope but the infrastructure supports it:

- NFT catches recorded in `game_events` with `prize_tier`
- `inventory` table holds treasury NFTs mapped to prize tiers
- `redemptions` table tracks claims
- Future: "Claim" button on NFT fish -> backend checks inventory -> transfers NFT from treasury

---

## Fish Value to $OP Conversion

Fish sell values in the game map directly to $OP amounts. The current in-game "coins" become $OP.

| Rarity | Value Range ($OP) | Examples |
|---|---|---|
| Common | 2-15 | Seaweed (2), Sand Dollar (15) |
| Junk | 0-15 | Plastic Bag (0), Skeleton Key (15) |
| Uncommon | 15-45 | Butterfly Fish (15), Flying Fish (45) |
| Rare | 50-150 | Lionfish (50), Lost Ring (150) |
| Epic | 150-500 | Manta Ray (150), Megalodon Tooth (500) |
| Legendary | 500-2,500 | Whale Shark (500), Kraken (2,500) |
| NFT | 0 (claim only) | Barnacle Key, Sunken Compass, Ancient Pearl, Ocean King Crown |

**Tackle Box cost:** 100 $OP for 10 casts (on-chain transfer to treasury)

**Rolling cap:** 1,000 $OP per 60-minute window (fishing only, not trading/staking)

---

## Catch Probabilities

50% chance of a bite per cast. Given a bite:

| Rarity | Chance | Effective per cast |
|---|---|---|
| Common | 35% | 17.5% |
| Junk | 30% | 15.0% |
| Uncommon | 15% | 7.5% |
| Rare | 10% | 5.0% |
| Epic | 6% | 3.0% |
| Legendary | 3% | 1.5% |
| NFT | 1% | 0.5% |

NFT sub-tiers (within the 1% NFT roll):
| Tier | Chance |
|---|---|
| Common (Barnacle Key) | 50% |
| Rare (Sunken Compass) | 30% |
| Ultra Rare (Ancient Pearl) | 15% |
| Legendary (Ocean King Crown) | 5% |

---

## Database Changes

### New Rows in `reward_rates`

```sql
INSERT INTO reward_rates (key, category, value, metadata) VALUES
  ('purchase.per_dollar', 'purchase', 10, '{"label":"$OP per $1 pathUSD spent buying NFTs"}'::jsonb),
  ('fishing.tackle_box_cost', 'fishing', 100, '{"label":"Tackle Box cost in $OP","casts_granted":10}'::jsonb),
  ('fishing.free_daily_casts', 'fishing', 5, '{"label":"Free daily casts"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

### No Schema Changes Needed

All required tables already exist with the right columns:
- `economy_events` - tracks all reward issuance (purchase + fish)
- `game_events` - tracks every fish catch
- `users` - wallet registry + cached balance
- `purchases` - not needed (using sales table + economy_events instead)
- `inventory` / `redemptions` - ready for Phase 6 NFT prizes

---

## Environment Variables to Add

```
REWARDS_SIGNER_PRIVATE_KEY=<see contracts/.env PRIVATE_KEY - this is the 0x7831... ops wallet>
REWARDS_CLAIMER_CONTRACT=<deployed RewardsClaimer address>
TREASURY_WALLET=<address to receive $OP for tackle box purchases>
```

**Key already exists:** The `PRIVATE_KEY` in `contracts/.env` maps to `0x7831959816fAA58B5Dc869b7692cebdb6EFC311E` - the ops wallet that already has MINTER_ROLE on $OP (verified on-chain). This same key will be used as `REWARDS_SIGNER_PRIVATE_KEY` in the Vercel/root `.env` for signing EIP-712 claim authorizations. The key only signs messages from the backend - it never sends transactions in this flow.

**On-chain role status (verified 2026-04-14):**
- `0x7831...` (ops wallet): has MINTER_ROLE on $OP
- `0x650F...` (staking contract): has MINTER_ROLE on $OP
- RewardsClaimer (to deploy): will need MINTER_ROLE granted via `$OP.grantRole(MINTER_ROLE, rewardsClaimerAddress)` from the admin wallet

---

## Build Order

| Step | What | Depends On | Estimated Scope |
|---|---|---|---|
| 1 | RewardsClaimer.sol + tests | Nothing | ~80 lines Solidity, ~150 lines tests |
| 2 | Deploy RewardsClaimer + grant MINTER_ROLE | Step 1, 0x7831... private key | Deploy script + 2 txs |
| 3 | `api/_signer.ts` + `api/economy/rewards/[address].ts` | Step 2, env vars | ~100 lines |
| 4 | `api/economy/sign-trading-claim.ts` | Step 3 | ~80 lines |
| 5 | Frontend: contract config + useRewards hook + claim UI | Step 4 | ~200 lines |
| 6 | `api/fish/cast.ts` + `api/fish/sell.ts` + `api/fish/state/[address].ts` | Step 3 | ~250 lines |
| 7 | `api/fish/buy-tackle-box.ts` | Step 6 | ~60 lines |
| 8 | `api/economy/sign-fishing-claim.ts` | Step 3 | ~80 lines (mirrors trading) |
| 9 | Frontend: useFishGameServer hook + FishPage wiring | Steps 6-8 | ~300 lines (mostly replacing localStorage) |
| 10 | Vite dev middleware for all new endpoints | Steps 3-8 | Mirror each endpoint |

**Steps 1-5** can ship independently as "Trading Rewards v1."
**Steps 6-9** can ship as "Fish Game v1."
Step 10 runs in parallel with each phase for local dev.

---

## Security Considerations

- **Signer key**: The `0x7831...` private key signs messages only, never sends txs or holds value beyond gas. If compromised, attacker can forge claim signatures, but nonces prevent double-claiming and the contract is auditable.
- **Fish RNG server-side**: Moving RNG to the server prevents client manipulation. Rate limiting (1 cast/5s) prevents scripting.
- **Rolling cap**: 1,000 $OP/hr cap on fishing prevents bot farming. No cap on trading/staking rewards.
- **Tackle box verification**: Backend verifies the on-chain $OP transfer before granting casts. Tx hash replay prevented by checking if already used.
- **Nonce management**: Trading and fishing have separate nonce counters. Each claim increments the nonce atomically on-chain.
