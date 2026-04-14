# Whale-Town Points Economy: Execution & Deployment Plan

## 1. Objective
Deploy the core Whale-Town Points Economy utilizing Thirdweb's ERC20 and ERC721 Staking contracts on the Tempo testnet (and later mainnet), and wire these components into the existing React frontend, specifically targeting the `StakingPage` and the backend `api/` logic for offchain rewards (Marketplace and Fish minigame).

## 2. Smart Contract Deployment Strategy

We will use Thirdweb's existing audited smart contracts to handle the onchain economy, minimizing custom code and security risks. 

**Contracts to Deploy (via Thirdweb dashboard/SDK):**
1. **DropERC20 (Whale-Town Points Token):**
   - A standard ERC20 token for the internal economy.
   - Initial supply: 0 (minted dynamically).
   - Roles: Backend treasury wallet needs `MINTER_ROLE` to issue offchain rewards (Marketplace, Fish game).
2. **Staking721Upgradeable (NFT Staking Contract):**
   - Connects to the existing Whale-Town NFT collection and the newly deployed ERC20 Points Token.
   - Users stake their NFTs to earn Points.

**Deployment Steps:**
- Deploy contracts on Tempo Testnet using Foundry or Thirdweb CLI.
- Configure Staking721Upgradeable to use the deployed DropERC20 as the reward token.
- Grant `MINTER_ROLE` on the DropERC20 to the Staking contract and the backend treasury wallet.

## 3. Backend (Vercel API) & Automation

We need to build offchain infrastructure to handle rewards that aren't natively managed by the staking contract (Marketplace and Minigame rewards), and enforce the rolling 1000-points-per-60-minutes cap.

**Key Additions:**
1. **Postgres Database Tables:**
   - `economy_events`: Tracks wallet, event_type (purchase, fish, staking_claim), points_awarded, timestamp. Used to enforce the 1000 points / hr cap.
   - `inventory`: Tracks treasury-held external NFTs available for redemption.
   - `redemptions`: Tracks user redemptions.
2. **Webhooks / Event Listeners (via Goldsky or Vercel cron):**
   - `api/economy/marketplace-rewards.ts`: Triggered on NFT purchase. Calculates points and records them in the DB.
   - `api/economy/fish-rewards.ts`: Triggered when users win the fishing game. Records points/entitlements.
3. **Daily Batch Minting Job (`api/cron/mint-points.ts`):**
   - Runs daily via Vercel Cron.
   - Aggregates unminted points for each user.
   - Uses the Thirdweb Engine/SDK and the Treasury Wallet private key to mint the accumulated ERC20 tokens to the respective users in batches.

## 4. Frontend Wiring (`src/pages/StakingPage.tsx` and `src/App.tsx`)

The frontend needs to interact with the deployed Thirdweb contracts to display user points, manage staking, and allow prize redemption.

**Key Changes:**
1. **Thirdweb SDK Integration:**
   - Install and configure `@thirdweb-dev/react` and `@thirdweb-dev/sdk`.
   - Wrap the app in `<ThirdwebProvider>` configured for the Tempo network, alongside existing Wagmi/RainbowKit.
2. **Global Points Display (`src/App.tsx`):**
   - Use `useContractRead` (Thirdweb) or `useBalance` (Wagmi) to fetch the user's ERC20 Points balance.
   - Display the points balance in the top navigation bar next to the user's wallet.
3. **Staking Page Overhaul (`src/pages/StakingPage.tsx`):**
   - **Staking Pool UI:** Display the user's unstaked NFTs. Allow them to select and stake them using the Thirdweb Staking contract's `stake` function.
   - **Rewards UI:** Display currently staked NFTs and accumulated (unclaimed) rewards. Use the `claimRewards` function to transfer points to the user's wallet.
   - Replace the current hardcoded "-- OCEAN" and "COMING SOON" tooltips with live contract data.
4. **Fishing Game Integration (`src/components/fish/GameScene.tsx`):**
   - On a successful catch, call the backend API (`/api/economy/fish-rewards`) to register the win and calculate point entitlements offchain.

## 5. Rollout Phases

**Phase 1: Smart Contracts & DB Setup**
- Deploy DropERC20 and Staking721Upgradeable on Tempo Testnet.
- Initialize new Postgres tables for economy tracking.

**Phase 2: Frontend Staking**
- Integrate Thirdweb SDK.
- Update `StakingPage.tsx` to support staking, unstaking, and claiming rewards.
- Test with mock NFTs.

**Phase 3: Offchain Rewards (Backend)**
- Build the `marketplace-rewards.ts` and `fish-rewards.ts` API endpoints.
- Build the daily batch minting cron job.
- Enforce the 1000 points / 60 min cap logic.

**Phase 4: Production & Mainnet**
- Migrate contracts to Mainnet.
- Fund Treasury Wallet.
- Enable the Fish game button in the navigation bar.