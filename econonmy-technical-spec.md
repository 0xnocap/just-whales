# Whale-Town Points Economy Technical Specification

## 1. Purpose

This document defines the Whale-Town points economy, including earning rules, staking rewards, distribution logic, automation requirements, and redemption handling.

Whale-Town points are the primary internal currency of the ecosystem. Users earn points through marketplace activity, NFT staking, fishing/minigames, and special event rewards.

External NFT rewards are not minted as a new in-house collection. Instead, they are sourced from existing collections held in a treasury wallet and distributed through backend redemption logic.

---

## 2. Core Design Principles
WE WILL BE FORKING THIRDWEBS TokenERC20 CONTRACT AND THEIR ERC721 STAKING CONTRACT TO BE DEPLOYED ON TEMPO TESTNET FIRST, THEN MAINNET. TESTED CRYPTOGRAPHICALLY WITH FOUNDRY.

THIRDWEB REPO: https://github.com/thirdweb-dev
ERC20 TOKEN CONTRACTS: https://thirdweb.com/thirdweb.eth/DropERC20
GH STAKING CONTRACTS: https://github.com/thirdweb-dev/contracts/blob/main/contracts/extension/Staking721Upgradeable.sol


THIRDWEB GITHUB REPO: 

2.1. One ERC-20 token will represent Whale-Town points.

2.2. Whale-Town points are not intended to represent real monetary value.

2.3. External NFT rewards come from existing collections held in treasury.

2.4. Reward calculations happen offchain in a database and are distributed in batches.

2.5. A daily automation job is preferred over real-time minting for operational simplicity.

2.6. Staking rewards accrue daily based on NFT type and traits.

2.7. Fishing rewards support both point payouts and prize entitlements.

2.8. Admins must be able to update point tables without redeploying core contracts.

2.9. Users may transfer points.

2.10. Staking rewards are claimable onchain.

2.11. Redemptions are instant and programmatic.

---

## 3. System Components

### 3.1 Onchain Components

3.1.1. **Points Token**
- Contract type: ERC-20.
- Purpose: Whale-Town points balance.
- Minting: controlled by admin/backend wallet.
- Transfers: enabled.
- Point issuance must respect the rolling hourly cap defined in this spec.

3.1.2. **NFT Staking Contract**
- Contract type: ERC-721 staking.
- Purpose: allows users to stake eligible NFTs and earn daily points.
- Rewards are claimable onchain.

3.1.3. **Treasury Wallet**
- Purpose: holds external NFT prize inventory.
- Used for redemptions involving NFTs from other collections.

### 3.2 Offchain Components

3.2.1. **Database**
Stores:
- User wallets.
- Purchase events.
- Staking positions.
- Daily point accrual records.
- Game outcomes.
- Redemptions.
- Prize inventory.
- Admin-adjustable rate tables.

3.2.2. **Event Capture Layer**
Receives:
- Marketplace purchase events.
- Stake and unstake events.
- Fishing game outcomes.
- Redemption requests.

3.2.3. **Daily Scheduler**
Runs every 24 hours to:
- Aggregate purchase activity.
- Calculate staking points.
- Process fishing rewards.
- Create leaderboard distributions.
- Mint points in batches.
- Execute NFT reward transfers if approved.

3.2.4. **Backend Minting / Transfer Worker**
Responsible for:
- Minting points from the treasury/backend wallet.
- Sending NFTs from the treasury wallet to winners.
- Recording successful transactions in the database.

---

## 4. Whale-Town NFT Points Table

### 4.1 Base Daily Staking Rates

| NFT Type | Daily Points |
|---|---:|
| Sea Lion | 5 |
| Shark | 10 |
| Whale | 20 |

### 4.2 Rare Body Rates

| NFT Type | Daily Points |
|---|---:|
| Golden Whale | 35 |
| White Spotted Sea Lion | 20 |
| Great White Shark | 20 |

### 4.3 Rare Trait Bonuses

| Trait | Daily Bonus Points |
|---|---:|
| Sea Lion Gold Chain | 10 |
| Shark Pirate Captain Coat | 15 |
| Diamond Watch Whale | 30 |
| Gold Watch Whale | 25 |

### 4.4 Stacking Rule

Trait bonuses stack on top of body bonuses automatically.

### 4.5 Example Outcomes

- Sea Lion + Gold Chain = 15 points/day.
- Shark + Pirate Captain Coat = 25 points/day.
- Whale + Gold Watch = 45 points/day.
- Golden Whale + Diamond Watch = 65 points/day.

---

## 5. Earning Rules

### 5.1 Marketplace Purchase Rewards

Users earn points when they purchase NFTs on the Whale-Town marketplace.

Recommended logic:
- Fixed points per NFT purchase.
- Or percentage-based points tied to purchase volume.
- Or tier-based points by NFT class.

Implementation:
1. Record the purchase event immediately.
2. Aggregate all purchases per wallet once per day.
3. Mint the final total in a daily batch.

### 5.2 Staking Rewards

Users earn daily points for each staked NFT.

Rules:
- Base rate depends on NFT body type.
- Bonus rate applies for rare bodies.
- Trait bonuses add on top of the body rate and stack automatically.
- Rewards accrue per wallet per day.
- Users claim rewards onchain.

### 5.3 Fishing / Minigame Rewards

Users can earn:
- Direct points.
- Prize entitlements.
- Leaderboard placement rewards.

Leaderboard example:
- Weekly top 10 earn a fixed reward amount.
- Reward amount may be updated seasonally.

### 5.4 Prize Entitlements

Fishing results may generate:
- Common prize credits.
- Rare prize credits.
- Epic prize credits.
- Legendary prize credits.

These credits can later be redeemed for:
- Points.
- Treasury NFTs.
- WL tickets.
- Special ecosystem items.

---

## 6. Point Cap Rule

### 6.1 Rolling Hourly Cap

A user may not earn more than 1000 points in any rolling 60-minute period.

### 6.2 Enforcement Logic

- Point issuance is tracked by timestamp.
- At the time of a new reward event, the system checks how many points the user has earned in the previous 60 minutes.
- The user may only receive the amount that keeps them at or below 1000 points in that rolling window.
- As older points age past the 60-minute mark, new earning capacity becomes available again automatically.

### 6.3 Example Behavior

- If a user earns 1000 points in 10 minutes, they immediately hit the cap and cannot earn more until older points roll out of the 60-minute window.
- If a user earns 100 points in 10 minutes and then 900 more over the next 40 minutes, they stop earning once the rolling total reaches 1000.
- This is a sliding window limit, not a clock-hour reset.

### 6.4 Overflow Handling

- Excess points above the cap should not be auto-deferred unless explicitly added later.
- Recommended default: cap immediately and log overflow for analytics.

---

## 7. Distribution Flow

### 7.1 Marketplace Purchase Flow

1. User buys an NFT.
2. Purchase event is recorded.
3. Daily worker aggregates all purchases by wallet.
4. Backend mints total points to the user wallet.
5. Database logs issuance.

### 7.2 Staking Flow

1. User stakes an NFT.
2. Staking contract starts accrual.
3. Reward rate is determined by body type and trait bonuses.
4. User claims rewards onchain.
5. Database records claim history.

### 7.3 Fishing Flow

1. User plays the minigame.
2. Backend records the outcome.
3. If the result is points, add them to the daily payout ledger.
4. If the result is a prize entitlement, add it to redemption inventory.
5. Daily job processes final rewards.

### 7.4 Redemption Flow

1. User redeems points for a reward.
2. Backend checks inventory and eligibility.
3. If the reward is an external NFT, the treasury wallet transfers it to the user.
4. Backend deducts points from the user’s balance.
5. Redemption is marked complete.

---

## 8. Automation Rules

### 8.1 Daily Jobs

Run once per day:
- Purchase reward aggregation.
- Fishing reward processing.
- Leaderboard reward allocation.
- Minting of points.
- NFT redemption execution.

### 8.2 Weekly Jobs

Run once per week:
- Update point tables if needed.
- Rotate leaderboard cycles.
- Rebalance prize inventory.
- Adjust reward caps if needed.

### 8.3 Event-Driven Jobs

Triggered by:
- Purchase completion.
- Stake or unstake action.
- Game result submission.
- Redemption request.

---

## 9. Admin Controls

Admins must be able to:
- Update daily staking rates.
- Adjust trait bonuses.
- Modify purchase reward formulas.
- Change fishing reward tiers.
- Approve or reject redemptions.
- Add or remove reward inventory.
- Set rolling-hour enforcement logic.
- Pause minting or redemption if needed.

---

## 10. Required Data Fields

### 10.1 User Table
- Wallet address.
- Discord or platform ID if applicable.
- Join date.
- Total points balance.
- Redemption history.

### 10.2 Staking Table
- Wallet address.
- Token ID.
- Collection.
- Staked timestamp.
- Rate tier.
- Trait flags.
- Accrued points.

### 10.3 Purchase Table
- Wallet address.
- NFT purchased.
- Collection.
- Purchase price.
- Purchase timestamp.
- Points due.
- Minted status.

### 10.4 Game Table
- Wallet address.
- Game result.
- Points earned.
- Prize entitlement type.
- Redeemed status.

### 10.5 Redemption Table
- Wallet address.
- Reward requested.
- Points spent.
- Treasury asset ID.
- Transfer transaction hash.
- Status.

---

## 11. Recommended Contract Strategy

### 11.1 Deploy
- One ERC-20 points token.
- One NFT staking contract.

### 11.2 Do Not Deploy Yet
- A new mintable prize NFT collection, unless Whale-Town later decides to create its own in-house rewards.

### 11.3 Use Instead
- A single treasury wallet holding external NFTs from partner or existing collections.
- Backend logic to transfer those NFTs on redemption.

---

## 12. Suggested Version 1 Scope

### 12.1 Phase 1
- Deploy points token.
- Deploy staking contract.
- Build database tables.
- Create purchase event capture.
- Create daily minting worker.

### 12.2 Phase 2
- Add staking accrual logic.
- Add fishing rewards.
- Add leaderboard system.
- Add redemption flow for NFTs and WL tickets.

### 12.3 Phase 3
- Add seasonal reward changes.
- Add trait-based multipliers.
- Add prize inventory management.
- Add event-based bonus campaigns.

---

## 13. Example Reward Logic

### 13.1 Staked Whale with Gold Watch
- Base Whale: 20 points/day.
- Gold Watch Whale bonus: 25 points/day.
- Total: 45 points/day.

### 13.2 Staked Shark with Pirate Captain Coat
- Base Shark: 10 points/day.
- Pirate Captain Coat bonus: 15 points/day.
- Total: 25 points/day.

### 13.3 Staked Golden Whale with Diamond Watch
- Base Golden Whale: 35 points/day.
- Diamond Watch bonus: 30 points/day.
- Total: 65 points/day.

---

## 14. Open Questions for Future Expansion

- Should fishing rewards have cooldowns?
- Should some redemptions require manual approval in high-risk cases?
- Should external NFT inventory eventually be split across multiple treasury wallets?
- Should points remain fully transferable forever, or should there later be special non-transferable event points?

---

## 15. Summary Build Recommendation

The recommended Whale-Town implementation is:
- ERC-20 points token for all internal rewards.
- ERC-721 staking contract for daily NFT earning.
- Backend database and daily cron job for reward calculation.
- Treasury wallet for holding external NFT prizes.
- Offchain redemption logic for transferring reward NFTs.
- Admin dashboard for rate changes and reward management.
- Rolling 1000-points-per-60-minutes cap for anti-farm control.