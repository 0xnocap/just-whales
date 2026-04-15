# Fishing Game Polish Plan (Phases 4 & 5)

## Background & Motivation
The fishing game functionality is largely working, but requires UX polish and adjustments to in-game economy mechanics to prepare for shipping. Specifically, the UI in the Net tab is glitchy when selling rapidly, the distinction between unclaimed off-chain "$OP" and the on-chain "$OP" used in the Market is confusing, and a long-term limit on Journal completions needs to be enforced.

## Scope & Impact
- **Net Tab:** Add loading states to prevent multiple clicks and rename "Coins" to "Unclaimed $OP" to eliminate confusion.
- **Market Tab:** Read and display the actual on-chain `$OP` wallet balance to gate purchases like the Tackle Box.
- **Journal & Mechanics:** Implement a hard limit on Journal completions. Since items remain off-chain for now (with future NFT redemption planned), we will introduce a global drop cap (max 12) on specific "gatekeeper" species. This guarantees only 12 full journals can ever exist.

## Implementation Steps

### 1. Net Tab Polish & Terminology
- **Rename Terms:** Update all instances of "Coins" in `FishPage.tsx` to "Unclaimed $OP".
- **Loading State:** Update `useFishGameServer.ts` and `FishPage.tsx` to track `isSelling` (e.g., storing the `gameEventId` being processed).
- **UI Update:** Disable the sell button and show a "Selling..." or spinner state while the API call is in flight, preventing rapid multi-clicks.

### 2. Market Tab & Wallet Integration
- **Read Balance:** Use Wagmi's `useReadContract` in `FishPage.tsx` or `useFishGameServer.ts` to read the user's ERC-20 `$OP` balance from the points contract.
- **Display & Validation:** Show "Wallet Balance: X $OP" in the Market tab.
- **Gate Purchase:** Disable the Tackle Box "Buy" button if the user's on-chain balance is strictly less than the required 100 `$OP`.

### 3. The "12 Journals" Global Cap
- **Identify Gatekeepers:** Designate one or two specific Ultra Rare / Legendary items (e.g., `kraken-tentacle` or a new item) as "gatekeepers".
- **Enforce Limit:** Update the drop logic in `api/fish/cast.ts` to query the database for the total number of gatekeeper items ever dropped. If the count reaches 12, the item is removed from the drop pool and replaced with a common item.

## Migration & Rollback
- Since these changes mostly refine existing logic, rollback involves reverting the UI state and removing the drop caps from the `cast.ts` API. No breaking database schema changes are required.

## Verification & Testing
1. **Sell State:** Click "Sell" on a fish; verify the button disables and shows a loading state until the balance updates.
2. **Balance Check:** Visit the Market tab with an empty wallet; verify the Tackle Box buy button is disabled due to insufficient balance. Visit with 100+ $OP and verify it is enabled.
3. **Drop Cap:** Manually test `cast.ts` logic (or write a test script) to ensure a gatekeeper item cannot drop more than 12 times globally.
