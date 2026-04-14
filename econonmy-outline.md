# Whale-Town Points Economy Plan

## Overview

Whale-Town should be built around a single ERC-20 points token as the core accounting layer. Users earn points through marketplace activity, NFT staking, and mini-games, while rare rewards are handled separately through transfers from treasury-held NFTs in other collections.

This approach keeps the economy simple, scalable, and easy to automate.

## What Users Can Do

- Buy NFTs on the marketplace and earn points.
- Stake NFTs and earn daily points based on body type and trait class.
- Play the fishing game and win points, prize entitlements, or leaderboard rewards.
- Redeem points later for partner NFTs, WL tickets, boosts, and special items held by your treasury.

## Core Systems to Deploy

| Component | Purpose | Notes |
|---|---|---|
| ERC-20 points token | Main Whale-Town points balance | Single source of truth for user points. |
| NFT staking contract | NFT staking rewards | Users stake eligible NFTs and earn points or reward claims over time. |
| Backend wallet / engine | Automated minting and transfers | Used for daily point minting and NFT prize transfers. |
| Webhooks / event listeners | Capture purchases and reward events | Trigger database updates and daily calculations. |
| Treasury wallets | Hold external NFT prize inventory | Needed because prize NFTs come from other collections. |

## Core Earning Rails

### Marketplace Rewards
- User buys an NFT.
- App logs the purchase.
- A daily job calculates the points due.
- Backend mints points to the user’s wallet in a batch.

### Staking Rewards
- User stakes an NFT.
- The staking contract tracks time staked.
- Your rules determine the daily point rate by body type and trait bonus.
- Users either claim rewards directly or your backend tops them up on a schedule.

### Fishing / Minigame Rewards
- User wins points, item entitlements, or leaderboard placement.
- Backend stores the result.
- The daily batch job either mints points or issues a redemption credit.
- Some wins can be converted into prize NFTs later from treasury stock.

## Prize NFT Flow

Because these NFTs are from other collections, the reward flow should not rely on a drop contract to mint them. Instead, your treasury wallet should hold the prize NFTs, and your backend transfers them to winners when a redemption is approved.

### Prize Redemption Process
1. User earns or spends points.
2. User selects a prize redemption.
3. Backend checks treasury inventory.
4. Backend approves the redemption.
5. Treasury wallet transfers the external NFT to the user.
6. Backend deducts points and records the event.

## Important Rules to Define

Before launch, lock these rules down:

- Staking rates for each body type.
- Trait bonuses and whether they stack.
- Marketplace point rate per purchase or per volume.
- Fishing reward tables and leaderboard payouts.
- Redemption costs for NFTs and other items.
- Inventory rules for external NFT prizes.
- Emission caps per wallet, per day, and per season.
- Admin permissions for changing reward tables and approving redemptions.

## Suggested Automation Stack

| Layer | Function |
|---|---|
| Webhooks | Capture purchases, stake events, and gameplay outcomes. |
| Database | Store user activity, pending rewards, and redemption state. |
| Scheduler | Run every 24 hours. |
| Calculation worker | Compute each wallet’s total points and redemption eligibility. |
| Backend wallet / engine | Mint points or execute NFT transfers. |

## Distribution Model

### Tier 1: Base Points
- Marketplace purchases.
- NFT staking.

### Tier 2: Active Points
- Fishing game wins.
- Participation rewards.
- Event bonuses.

### Tier 3: Premium Rewards
- Special leaderboard payouts.
- Rare item drops.
- Approved redemptions for external NFTs.

### Tier 4: Redemption Layer
- Burn or spend points for NFT prizes.
- WL tickets.
- Boosts.
- Partner perks.

## Rollout Plan

### Phase 1
- Deploy the ERC-20 points token.
- Deploy staking support.
- Define point tables and redemption tables.
- Set up database tables for purchases, staking, game results, and prize inventory.

### Phase 2
- Build webhook capture and daily batch minting.
- Test point calculation on a small wallet set.
- Verify staking math and purchase aggregation.
- Confirm treasury NFT transfer flow for external rewards.

### Phase 3
- Launch staking rewards.
- Launch marketplace purchase points.
- Launch fishing rewards and leaderboard payouts.

### Phase 4
- Launch redemptions for external NFTs and special perks.
- Add seasonal resets, special event drops, and bonus campaigns.

## Best Contract Strategy

For Whale-Town, the best setup is:

- One ERC-20 points token.
- One NFT staking contract.
- One backend reward engine.
- One or more treasury wallets holding external NFTs.
- No new reward NFT drop collection unless you later decide to mint your own prizes.