# App.tsx Modular Refactor Plan

## Overview

Break the 2,729-line `src/App.tsx` monolith into a proper modular structure. Zero behavior or visual changes — pure structural extraction.

**Primary goals:**
- Maintainability: each file has one clear responsibility
- Scalability: designed to support multiple collections in the future
- DRY: no repeated fetch logic, no duplicated types or constants

---

## Target Structure

```
src/
  main.tsx                         (unchanged)
  App.tsx                          (routing + layout + global state, ~100 lines)
  wagmi.ts                         (unchanged)
  index.css                        (unchanged)

  types/
    index.ts                       (ModalTokenProps, CollectionData, ActivityFilterKey)

  constants/
    activity.ts                    (ACTIVITY_FILTERS array)
    trade.ts                       (BATCH size, sort options)

  lib/
    api.ts                         (all fetch('/api/...') calls — one place)

  utils/
    format.ts                      (sleep, truncateAddress, timeAgo, timeUntil)
    rasterize.ts                   (imageCache Map, rasterizeImage fn)

  hooks/
    useActivityFeed.ts             (fetch + filter logic from ActivityFeed)
    useCollectionData.ts           (owners + stats + listings fetch from TradePage)

  components/
    BlockiesAvatar.tsx
    CopyButton.tsx
    SkeletonCard.tsx
    StatsSkeleton.tsx
    FishingPoleIcon.tsx
    DreamwaveOcean.tsx
    ActivityItem.tsx
    ActivityFeed.tsx
    ActivitySidebar.tsx
    NFTCard.tsx
    SweepBar.tsx
    RetroButton.tsx
    TokenModal.tsx
    TradeScrollSentinel.tsx

  pages/
    HomePage.tsx
    StakingPage.tsx
    MintPage.tsx
    TradePage.tsx
    ProfilePage.tsx
```

---

## Extraction Order (dependency graph)

Steps flow from no-dep leaves to dependent roots. Each step: extract → confirm app compiles → remove from App.tsx.

```
Step 1:  types/index.ts            — no deps
Step 2:  constants/activity.ts     — no deps
Step 3:  constants/trade.ts        — no deps
Step 4:  lib/api.ts                — no deps
Step 5:  utils/format.ts           — no deps
Step 6:  utils/rasterize.ts        — no deps
Step 7:  components/BlockiesAvatar — no internal deps
Step 8:  components/CopyButton     — no internal deps
Step 9:  components/SkeletonCard   — no internal deps
Step 10: components/StatsSkeleton  — no internal deps
Step 11: components/DreamwaveOcean — no internal deps
Step 12: components/FishingPoleIcon — no internal deps
Step 13: components/RetroButton    — no internal deps
Step 14: components/ActivityItem   — deps: types, constants/activity, utils/format
Step 15: hooks/useActivityFeed     — deps: types, constants/activity, lib/api
Step 16: components/ActivityFeed   — deps: types, constants/activity, hooks/useActivityFeed, ActivityItem
Step 17: components/ActivitySidebar — deps: ActivityFeed
Step 18: components/SweepBar       — no internal deps
Step 19: components/NFTCard        — deps: utils/rasterize, utils/format, SkeletonCard
Step 20: components/TradeScrollSentinel — no internal deps
Step 21: components/TokenModal     — deps: types, utils/format, BlockiesAvatar, CopyButton
Step 22: hooks/useCollectionData   — deps: lib/api, utils/format
Step 23: pages/TradePage           — deps: types, constants, lib/api, hooks/useCollectionData,
                                           NFTCard, SweepBar, SkeletonCard, StatsSkeleton,
                                           ActivityFeed, ActivitySidebar, TradeScrollSentinel
Step 24: pages/ProfilePage         — deps: utils/format, lib/api, BlockiesAvatar, CopyButton, SkeletonCard
Step 25: pages/StakingPage         — no deps
Step 26: pages/MintPage            — no internal deps
Step 27: pages/HomePage            — no internal deps
Step 28: App.tsx rewrite           — all above
Step 29: verify
```

---

## Pre-flight

Create directories before starting:

```bash
mkdir -p src/types src/constants src/lib src/utils src/hooks src/components src/pages
```

**Strategy:** Extract → `npx tsc --noEmit` confirms zero errors → remove from App.tsx. Never delete original code until the replacement compiles cleanly. Each step is independently reversible.

---

## STEP 1 — `src/types/index.ts`

Extract the shared TypeScript types. These are currently spread across App.tsx.

```ts
import type { TokenMetadata } from '../contract';

export type ModalTokenProps = TokenMetadata & {
  id: number;
  isListing?: boolean;
  listingData?: any;
  isOwner?: boolean;
  isSeller?: boolean;
  ownerAddress?: string;
  refetch?: () => void;
  onBuySuccess?: () => void;
};

export type CollectionData = {
  total: number;
  traitsIndex: Record<string, Record<string, number>>;
  rarityRanks: Record<string, number>;
  rarityScores: Record<string, number>;
  tokenTraits: Record<string, Record<string, string>>;
};

export type ActivityFilterKey = 'all' | 'sale' | 'list' | 'transfer';
```

**Gotchas:**
- `CollectionData` is declared inline inside TradePage as a local `type`. Delete it there once this file exists and update the `useState<CollectionData | null>` annotation to use the import.
- `ActivityFilterKey` is derived from `ACTIVITY_FILTERS` via `typeof`. After extraction, define it explicitly as above (same set of values).

---

## STEP 2 — `src/constants/activity.ts`

```ts
import type { ActivityFilterKey } from '../types';

export const ACTIVITY_FILTERS: { key: ActivityFilterKey; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'sale',     label: 'Sales' },
  { key: 'list',     label: 'Listed' },
  { key: 'transfer', label: 'Transfers' },
];
```

---

## STEP 3 — `src/constants/trade.ts`

```ts
export const TRADE_BATCH = 50;

export const SORT_OPTIONS = [
  { value: 'price_asc',   label: 'Price: Low → High' },
  { value: 'price_desc',  label: 'Price: High → Low' },
  { value: 'id_asc',      label: 'Token ID ↑' },
  { value: 'id_desc',     label: 'Token ID ↓' },
  { value: 'rarity_asc',  label: 'Rarity: Rare First' },
  { value: 'rarity_desc', label: 'Rarity: Common First' },
] as const;

export type SortOption = typeof SORT_OPTIONS[number]['value'];
```

---

## STEP 4 — `src/lib/api.ts`

Centralizes every `fetch('/api/...')` call in the app. This is the multi-collection readiness layer — in the future, collection slug can be passed as a parameter.

```ts
export const api = {
  activity: () =>
    fetch('/api/activity').then(r => r.json()),

  owners: () =>
    fetch('/api/owners').then(r => r.json()),

  listings: (seller?: string) =>
    fetch(seller ? `/api/collection/listings?seller=${seller}` : '/api/collection/listings')
      .then(r => r.json()),

  stats: () =>
    fetch('/api/collection/stats').then(r => r.json()),

  metadata: (ids: number[]) =>
    fetch(`/api/collection/metadata?ids=${ids.join(',')}`).then(r => r.json()),

  tokenHistory: (tokenId: number) =>
    fetch(`/api/token/${tokenId}/history`).then(r => r.json()),

  profile: (address: string) =>
    fetch(`/api/profile/${address}`).then(r => r.json()),
};
```

**Callers to update after this step:**
- `ActivityFeed` → `api.activity()`
- `TradePage` → `api.owners()`, `api.stats()`, `api.listings()`, `api.metadata()`
- `TokenModal` → `api.tokenHistory()`
- `ProfilePage` → `api.profile()`, `api.listings(seller)`

---

## STEP 5 — `src/utils/format.ts`

```ts
export const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

export function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function timeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

export function timeUntil(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;
  if (diff <= 0) return 'Expired';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
```

Do NOT remove from App.tsx until all consumers (TokenModal, ActivityItem, NFTCard, ProfilePage, TradePage) are extracted.

---

## STEP 6 — `src/utils/rasterize.ts`

```ts
export const imageCache = new Map<string, string>();

export const rasterizeImage = (dataUri: string, tokenId: number): Promise<string> => {
  // copy verbatim from App.tsx — do not change logic
};
```

`imageCache` must remain a module-level singleton. ES module caching guarantees one shared instance across all NFTCard renders.

---

## STEP 7 — `src/components/BlockiesAvatar.tsx`

Copy the `BlockiesAvatar` component verbatim. No imports needed beyond JSX transform.

```tsx
export default function BlockiesAvatar({ address, size = 32 }: { address: string; size?: number }) { ... }
```

---

## STEP 8 — `src/components/CopyButton.tsx`

```tsx
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
```

---

## STEP 9 — `src/components/SkeletonCard.tsx`

No imports needed. Pure JSX.

---

## STEP 10 — `src/components/StatsSkeleton.tsx`

No imports needed. Pure JSX.

---

## STEP 11 — `src/components/DreamwaveOcean.tsx`

```tsx
import { motion } from 'motion/react';
```

App.tsx must add `import DreamwaveOcean from './components/DreamwaveOcean'` and keep using it in the root layout.

---

## STEP 12 — `src/components/FishingPoleIcon.tsx`

No imports needed. Pure SVG JSX.

---

## STEP 13 — `src/components/RetroButton.tsx`

```tsx
import { motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
```

---

## STEP 14 — `src/components/ActivityItem.tsx`

The current ActivityItem has been redesigned — compact single-row layout, handles `cancel` events, renders `image_data` SVG thumbnails. Copy the current version verbatim.

```tsx
import { Tag, Sparkles, ArrowLeftRight, X, Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { truncateAddress, timeAgo } from '../utils/format';
```

---

## STEP 15 — `src/hooks/useActivityFeed.ts`

Extract the data-fetching and filtering logic from the `ActivityFeed` component into a custom hook.

```ts
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { ActivityFilterKey } from '../types';

export function useActivityFeed(externalFilter?: ActivityFilterKey) {
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalFilter, setInternalFilter] = useState<ActivityFilterKey>('all');

  const filter = externalFilter ?? internalFilter;

  useEffect(() => {
    api.activity()
      .then(data => setActivity(Array.isArray(data) ? data : []))
      .catch(() => setActivity([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? activity : activity.filter(i => i.type === filter);

  return { filtered, loading, filter, setFilter: setInternalFilter };
}
```

---

## STEP 16 — `src/components/ActivityFeed.tsx`

ActivityFeed is a new component added during the design refactor. It was not in the original plan.

```tsx
import { ACTIVITY_FILTERS } from '../constants/activity';
import { useActivityFeed } from '../hooks/useActivityFeed';
import ActivityItem from './ActivityItem';
import type { ActivityFilterKey } from '../types';
```

Props interface:
```ts
{
  compact?: boolean;
  externalFilter?: ActivityFilterKey;
  onFilterChange?: (f: ActivityFilterKey) => void;
}
```

---

## STEP 17 — `src/components/ActivitySidebar.tsx`

The ActivitySidebar is now a simple `w-72` card wrapper around ActivityFeed — much simpler than the original plan described.

```tsx
import { Activity, X } from 'lucide-react';
import ActivityFeed from './ActivityFeed';
```

Props: `{ isOpen: boolean; onClose: () => void }`

---

## STEP 18 — `src/components/SweepBar.tsx`

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { Zap, X, Loader2, ShoppingCart } from 'lucide-react';
```

Note: SweepBar uses `(totalCost / 1e6).toFixed(2)` directly — does not import `formatUnits`. Do not add it.

---

## STEP 19 — `src/components/NFTCard.tsx`

```tsx
import { useState, useEffect, useRef } from 'react';
import { Star, Clock } from 'lucide-react';
import { formatUnits } from 'viem';
import { imageCache, rasterizeImage } from '../utils/rasterize';
import { timeUntil } from '../utils/format';
import SkeletonCard from './SkeletonCard';
```

`imageCache` is referenced directly inside NFTCard to check/skip rasterization for already-cached tokens — import it from `../utils/rasterize`.

---

## STEP 20 — `src/components/TradeScrollSentinel.tsx`

```tsx
import { useEffect, useRef } from 'react';
```

---

## STEP 21 — `src/components/TokenModal.tsx`

The largest component extraction. Uses contract reads/writes directly.

```tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, Loader2, Sparkles, ArrowUpRight, ChevronDown } from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { formatUnits, parseUnits } from 'viem';
import {
  contractAddress, contractAbi,
  marketplaceAddress, marketplaceAbi,
  pathUSDAddress, pathUSDAbi,
  readPathUSDAllowance, readIsApprovedForAll,
  waitForTransaction,
} from '../contract';
import type { ModalTokenProps } from '../types';
import { truncateAddress, timeUntil } from '../utils/format';
import { api } from '../lib/api';
import BlockiesAvatar from './BlockiesAvatar';
import CopyButton from './CopyButton';
```

The `fetch(\`/api/token/${token.id}/history\`)` call inside TokenModal becomes `api.tokenHistory(token.id)`.

---

## STEP 22 — `src/hooks/useCollectionData.ts`

Extract TradePage's data-fetching logic (owners, stats, listings, metadata batching) into a custom hook. This is the largest hook and contains the infinite-scroll batch loading logic.

```ts
import { useState, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { TRADE_BATCH } from '../constants/trade';
import { sleep } from '../utils/format';
```

Returns: `{ tokens, listings, ownerMap, collectionStats, loading, loadingMore, ... }`

**Gotcha:** The `writeContractAsync` from `useWriteContract` is used in the sweep handler inside TradePage — this stays in TradePage since it's UI-action-triggered, not data-fetching. Only extract the pure data-loading logic.

---

## STEP 23 — `src/pages/TradePage.tsx`

The largest page extraction. TradePage has been substantially updated since the original plan (new banner layout, single sticky toolbar, activity tab, activity sidebar card).

```tsx
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, Zap, Check, Loader2, ChevronUp, ChevronDown, X, Grid3X3, Activity } from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { formatUnits } from 'viem';
import {
  marketplaceAddress, marketplaceAbi,
  pathUSDAddress, pathUSDAbi,
  readPathUSDAllowance,
  waitForTransaction,
} from '../contract';
import type { CollectionData } from '../types';
import { ACTIVITY_FILTERS } from '../constants/activity';
import { SORT_OPTIONS, TRADE_BATCH } from '../constants/trade';
import { api } from '../lib/api';
import { useCollectionData } from '../hooks/useCollectionData';
import SkeletonCard from '../components/SkeletonCard';
import StatsSkeleton from '../components/StatsSkeleton';
import NFTCard from '../components/NFTCard';
import SweepBar from '../components/SweepBar';
import ActivityFeed from '../components/ActivityFeed';
import ActivitySidebar from '../components/ActivitySidebar';
import TradeScrollSentinel from '../components/TradeScrollSentinel';
```

**Gotchas:**
- The inline `type CollectionData` inside TradePage becomes an import from `../types`
- `showActivity` and `setShowActivity` are currently props passed from App — this stays the same
- The `BATCH = 50` constant inside TradePage becomes `TRADE_BATCH` from constants

---

## STEP 24 — `src/pages/ProfilePage.tsx`

```tsx
import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Loader2, User, Sparkles, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import { useAccount, useReadContract } from 'wagmi';
import { useParams } from 'react-router-dom';
import { formatUnits } from 'viem';
import { contractAddress, contractAbi, readTokenURI, decodeTokenURI } from '../contract';
import { truncateAddress, timeAgo } from '../utils/format';
import { api } from '../lib/api';
import BlockiesAvatar from '../components/BlockiesAvatar';
import CopyButton from '../components/CopyButton';
import SkeletonCard from '../components/SkeletonCard';
```

The two `fetch('/api/...')` calls inside ProfilePage become `api.profile()` and `api.listings(seller)`.

---

## STEP 25 — `src/pages/StakingPage.tsx`

No imports needed beyond JSX transform. Pure JSX placeholder.

---

## STEP 26 — `src/pages/MintPage.tsx`

```tsx
import { useState, useEffect } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import {
  contractAddress, contractAbi,
  readTotalSupply, readMaxSupply, readMintPrice,
  readIsPublicMintActive, readMaxPerAddress,
  readTokenURI, decodeTokenURI,
} from '../contract';
import type { TokenMetadata } from '../contract';
```

---

## STEP 27 — `src/pages/HomePage.tsx`

```tsx
import { motion } from 'motion/react';
```

---

## STEP 28 — Rewrite `src/App.tsx`

After all extractions, App.tsx shrinks to routing + global state only (~100 lines):

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Coins, User, ArrowLeftRight } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';

import type { ModalTokenProps } from './types';
import DreamwaveOcean from './components/DreamwaveOcean';
import RetroButton from './components/RetroButton';
import FishingPoleIcon from './components/FishingPoleIcon';
import TokenModal from './components/TokenModal';
import HomePage from './pages/HomePage';
import StakingPage from './pages/StakingPage';
import TradePage from './pages/TradePage';
import MintPage from './pages/MintPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const [modalToken, setModalToken] = useState<ModalTokenProps | null>(null);
  const [sweepModeActive, setSweepModeActive] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isConnected, address } = useAccount();
  // ... routes
}
```

**Imports to remove** (no longer needed in App.tsx after extraction):
- `useEffect`, `useRef`, `useCallback`
- All lucide icons used only by extracted components
- All `./contract` imports (App itself calls no contract functions)
- `formatEther`, `parseEther`, `formatUnits`, `parseUnits` from `viem`
- `useWriteContract`, `useWaitForTransactionReceipt`, `useReadContract` from `wagmi`
- `useParams` from `react-router-dom`

---

## STEP 29 — Verification

Run in order after all steps complete:

```bash
# 1. TypeScript — zero new errors
npx tsc --noEmit

# 2. Build
npm run build

# 3. Dev server
npm run dev
```

**Smoke test checklist:**
- [ ] `/` — home page renders
- [ ] `/trade` — banner, toolbar, grid all render; floor price loads
- [ ] `/trade` — Items/Activity tab switch works
- [ ] `/trade` — Filters, Sort, Search work
- [ ] `/trade` — Live sidebar opens/closes
- [ ] `/trade` — Sweep mode activates, SweepBar appears
- [ ] `/trade` — Token modal opens on card click; history tab loads
- [ ] `/trade` — Buy/list/cancel flows complete in modal
- [ ] `/trade` — Infinite scroll fires at bottom
- [ ] `/mint` — connects wallet, shows mint price
- [ ] `/profile/:address` — loads owned tokens
- [ ] `imageCache` persists when navigating away from /trade and back

---

## Multi-collection Readiness Notes

The `lib/api.ts` layer is the main hook for future multi-collection support. When a second collection is added:

1. Add a `collectionSlug` parameter to the relevant `api.*` functions
2. API routes on the backend accept a `?collection=` query param
3. Collection config (name, contract address, description) lives in a `src/constants/collections.ts` file that maps slug → config
4. TradePage and ProfilePage accept a `collection` prop or read it from route params

No structural changes to components will be needed — the abstraction is already in place.
