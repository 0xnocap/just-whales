# Vercel Fast Origin Transfer Optimization Plan

## Current Status (2026-04-12)
- [x] **Phase 1: Cache Headers** - IMPLEMENTED. All API routes now use `s-maxage` for CDN caching.
- [x] **Phase 2: Payload Stripping** - IMPLEMENTED. Listings no longer include `image_data`. Frontend backfills missing images via 24h-cached metadata endpoint.
- [ ] **Phase 3: Activity Feed Stripping** - PAUSED. Decision made to prioritize UX (actual token thumbnails) over further bandwidth savings for now.
- [ ] **Phase 4: Ownership Sync** - PENDING. Future optimization if limits are still hit.

---

Fast Origin Transfer = bytes sent from Vercel Functions to the CDN.
Every API route response counts. Static files in `/public` do NOT count.
We are near the 10GB limit. This plan reduces it.

---

## Root Causes

### 1. No caching on most API endpoints
Without `Cache-Control`, every user request invokes the function.
With `s-maxage=30`, one function invocation serves all users within a 30s window from CDN cache.

### 2. `image_data` embedded in listings response
`/api/collection/listings` returns full `metadata` per listing, including the base64 SVG.
Each SVG is 10-50KB. With 30+ active listings that is 1MB+ per call.
No cache. Called on every TradePage load and after every contract event.

### 3. Activity feed polls every 30 seconds with `image_data` per item
`/api/activity` returns up to 100 items each with `image_data`.
100 items x ~15KB = ~1.5MB, every 30 seconds, per user, no cache.

### 4. Event-driven listing refreshes compound the problem
`refreshListings()` in `useCollectionData.ts` fires on every Sale, Cancelled, and Listed contract event. Each call hits `/api/collection/listings` with full image data. During active trading, this can trigger 3-5 listing refreshes in quick succession. The first event in each burst always invokes the function (cache miss). This makes Phase 2 (stripping image_data from listings) especially important since every event-driven refresh currently returns the full payload.

---

## API Endpoint Audit

| Endpoint | Est. Response Size | Cache Headers | Called When |
|---|---|---|---|
| `/api/owners` | ~200KB (3333 addresses) | None | Every TradePage load |
| `/api/collection/listings` | Large (includes image_data SVGs) | None | TradePage load + every Sale/Cancelled/Listed event |
| `/api/collection/listings?seller=X` | Subset of above, still includes SVGs | None | Every ProfilePage load |
| `/api/activity` | ~100 items x image_data | None | Every 30s poll per user + on refreshKey change |
| `/api/collection/stats` | ~200 bytes | None | Every TradePage load |
| `/api/collection/metadata` | Large (base64 SVGs) | `s-maxage=86400` | On scroll / pagination |
| `/api/profile/:address` | Token IDs + activity (no images) | None | Profile page loads |

---

## Phase 0 - Baseline Measurement

Before changing anything, record the current Fast Origin Transfer usage from the Vercel dashboard. This gives us a number to measure each phase against. Without a baseline, we're optimizing blind.

**Steps:**
1. Go to Vercel dashboard > project > Usage
2. Record the current Fast Origin Transfer total and daily average
3. Note the date and any context about current traffic levels

---

## Phase 1 - Cache Headers (immediate, zero risk, biggest impact)

Add `Cache-Control` to every API endpoint. No logic changes required.

| Endpoint | Header to Add |
|---|---|
| `/api/owners` | `public, s-maxage=60, stale-while-revalidate=120` |
| `/api/collection/listings` | `public, s-maxage=20, stale-while-revalidate=60` |
| `/api/activity` | `public, s-maxage=15, stale-while-revalidate=30` |
| `/api/collection/stats` | `public, s-maxage=60, stale-while-revalidate=180` |
| `/api/profile/:address` | `public, s-maxage=30, stale-while-revalidate=60` |

`s-maxage` = CDN serves from cache for this many seconds before re-invoking the function.
`stale-while-revalidate` = CDN serves stale content instantly while refreshing in the background.

**Cache key note:** `/api/collection/listings` accepts an optional `?seller=X` query param (used by ProfilePage). Vercel CDN keys on the full URL including query string, so `?seller=0xabc` and the bare endpoint cache independently. No `Vary` header is needed since the query string alone differentiates the responses.

**Expected impact:** Largest reduction. During any active usage window, most requests are served from CDN cache and never hit the function at all. The event-driven listing refreshes (Sale/Cancelled/Listed) are absorbed by the 20s cache window. Multiple users polling activity every 30s collapse into one function call per 15s per CDN region.

**Tradeoff:** `/api/profile/:address` at `s-maxage=30` means a user who just bought an NFT and navigates to their profile may see stale owned-token count for up to 30s. Acceptable tradeoff for the bandwidth savings.

**Files to change:**
- `api/collection/listings.ts` - add header before `res.status(200).json(...)` (line 35)
- `api/collection/stats.ts` - add header before `res.status(200).json(...)` (line 26)
- `api/owners.ts` - add header before `res.status(200).json(...)` (line 22)
- `api/activity.ts` - add header before `res.status(200).json(...)` (line 25)
- `api/profile/[address].ts` - add header before `res.status(200).json(...)` (line 35)

**Note:** The vite.config.ts dev middleware has the same endpoints reimplemented inline. Cache headers only matter in production (Vercel CDN), so the dev middleware does not need changes.

---

## Phase 2 - Strip `image_data` from Listings Response (medium effort, major size reduction)

The `/api/collection/listings` response includes a full `metadata` object per listing including the base64 SVG `image_data`. The frontend already fetches images via `/api/collection/metadata` which is cached for 24 hours.

**Fix:** Remove `image_data` from the metadata returned in listings. Only return what is needed for listing display: `name`, `attributes`.

### Backend change

In `api/collection/listings.ts`, strip `image_data` from the joined metadata at the handler level (before `res.status(200).json`):

```ts
const rows = result.rows.map((r: any) => {
  if (r.metadata) {
    const { image_data, ...rest } = r.metadata;
    return { ...r, metadata: rest };
  }
  return r;
});
res.status(200).json(rows);
```

SQL-level stripping (`t.metadata - 'image_data'`) is cleaner but ties us to PostgreSQL's JSONB operators and is harder to reverse if needed. Handler-level is more portable.

### Frontend change - useCollectionData.ts (critical)

**The problem:** Listed tokens currently get their `image_data` directly from the listing metadata. In `useCollectionData.ts`, the listing processing at line 99 spreads `l.metadata` into the token object. If we strip `image_data` from the API, `token.image_data` is `undefined` for every listed token that hasn't been separately loaded via gallery scroll.

**Listed tokens float to the top of the grid (above unlisted tokens), so they are the FIRST things users see.** Broken images on the most prominent items would be a severe UX regression.

**The fix:** After fetching listings, do a single `fetchMetadataBatched(listedTokenIds)` call to backfill image data before setting state. The `fetchMetadataBatched` function already exists at line 33. The `/api/collection/metadata` endpoint is cached 24h on CDN (`s-maxage=86400`), so this costs almost zero Fast Origin Transfer after the first request.

**Important: Do NOT set listings state before the backfill completes.** The original plan had two `setListings` calls (one before backfill, one after), which would cause a flash of missing images as React renders the imageless listings between the two state updates.

In `fetchData()`, replace the `listingsPromise` block (lines 93-114):

```ts
const listingsPromise = fetchListings.then(async (data) => {
  if (!Array.isArray(data)) return [];
  const now = BigInt(Math.floor(Date.now() / 1000));
  const activeListings = data.map((l: any) => {
    try {
      if (l.expires_at === '0' || now <= BigInt(l.expires_at)) {
        const metadata = l.metadata || { name: `Token #${l.token_id}`, attributes: [] };
        return {
          ...l,
          tokenId: BigInt(Math.floor(Number(l.token_id))),
          price: BigInt(Math.floor(Number(l.price))),
          expiresAt: BigInt(Math.floor(Number(l.expires_at))),
          id: BigInt(Math.floor(Number(l.listing_id))),
          metadata,
        };
      }
    } catch {}
    return null;
  }).filter(Boolean);

  // Backfill image_data from 24h-cached metadata endpoint BEFORE setting state.
  // This avoids a flash of missing images on listed tokens.
  const listedIds = activeListings.map((l: any) => Number(l.tokenId));
  if (listedIds.length > 0) {
    const metadataMap = await fetchMetadataBatched(listedIds);
    activeListings.forEach((l: any) => {
      const meta = metadataMap[Number(l.tokenId)];
      if (meta?.image_data && l.metadata) {
        l.metadata = { ...l.metadata, image_data: meta.image_data };
      }
    });
  }

  setListings(activeListings);
  return activeListings;
});
```

Note: the backfill creates new metadata objects (`{ ...l.metadata, image_data }`) instead of mutating in place. This avoids subtle bugs if any other code holds references to the listing objects.

### Frontend change - refreshListings() (also critical)

`refreshListings()` at line 130 fires on every Sale/Cancelled/Listed contract event. It also processes listing metadata and must also backfill. During active trading, events can fire in quick succession (3-5 events in seconds). The backfill call is cheap (24h CDN cache), but to prevent stacking, wrap in a simple guard:

```ts
const refreshListings = useCallback(async () => {
  try {
    const data = await api.listings();
    if (!Array.isArray(data)) return;
    const now = BigInt(Math.floor(Date.now() / 1000));
    const active = data.map((l: any) => {
      try {
        if (l.expires_at === '0' || now <= BigInt(l.expires_at)) {
          const metadata = l.metadata || { name: `Token #${l.token_id}`, attributes: [] };
          return {
            ...l,
            tokenId: BigInt(Math.floor(Number(l.token_id))),
            price: BigInt(Math.floor(Number(l.price))),
            expiresAt: BigInt(Math.floor(Number(l.expires_at))),
            id: BigInt(Math.floor(Number(l.listing_id))),
            metadata,
          };
        }
      } catch {}
      return null;
    }).filter(Boolean);

    // Backfill image_data before setting state
    const listedIds = active.map((l: any) => Number(l.tokenId));
    if (listedIds.length > 0) {
      const metadataMap = await fetchMetadataBatched(listedIds);
      active.forEach((l: any) => {
        const meta = metadataMap[Number(l.tokenId)];
        if (meta?.image_data && l.metadata) {
          l.metadata = { ...l.metadata, image_data: meta.image_data };
        }
      });
    }

    setListings(active);
  } catch {}
}, []);
```

### Frontend change - ProfilePage.tsx (also required)

ProfilePage fetches listings independently via `api.listings(profileAddress)` at line 88 and processes them with the same metadata spread at line 111. It renders listing images at line 555:

```tsx
<img src={listing.metadata.image_data} .../>
```

This is NOT covered by the `useCollectionData` backfill. ProfilePage needs its own backfill after processing listings. At line 124 (`setListings(active)`), add a backfill before setting state, following the same pattern:

```ts
// After building the `active` array (line 123), before setListings:
const listedIds = active.map((l: any) => Number(l.token_id));
if (listedIds.length > 0) {
  const metadataMap = await api.metadata(listedIds);
  active.forEach((l: any) => {
    const meta = metadataMap[Number(l.token_id)];
    if (meta?.image_data && l.metadata) {
      l.metadata = { ...l.metadata, image_data: meta.image_data };
    }
  });
}
setListings(active);
```

Note: ProfilePage uses `l.token_id` (raw from API) not `l.tokenId` (BigInt conversion), so the backfill key must match.

### Files to verify after implementation

- `src/components/NFTCard.tsx` - Uses `token.image_data` (comes from `...l.metadata` spread). Works after backfill.
- `src/components/TokenModal.tsx` - Uses `token.image_data`. Works after backfill.
- `src/pages/ProfilePage.tsx` - Uses `listing.metadata.image_data` at line 555. Requires its own backfill (specified above).

**Expected impact:** Reduces listings response by 10-50x depending on active listing count. The backfill via `/api/collection/metadata` is essentially free due to 24h CDN cache.

**Files to change:**
- `api/collection/listings.ts` - strip `image_data` from response
- `src/hooks/useCollectionData.ts` - add metadata backfill in `fetchData()` and `refreshListings()`
- `src/pages/ProfilePage.tsx` - add metadata backfill after listing fetch

---

## Phase 3 - Reduce Activity Feed Transfer

`/api/activity` joins on the tokens table to include `image_data` for the tiny 32x32 thumbnail in `ActivityItem`. This adds ~15KB per item x 100 items = ~1.5MB per response, polled every 30s per user.

### Step 1 (do first): Cache header only

The Phase 1 cache header (`s-maxage=15, stale-while-revalidate=30`) collapses per-user polling into per-region polling. With this cache, the 30s poll from `useActivityFeed` means at most 1 function call per 15 seconds per CDN region, regardless of how many users are connected. This is simple and preserves the existing UX (actual token thumbnails in the feed).

**Expected impact:** Reduces function invocations from (N users x 2/min) to (1/15s per region).

**Caveat:** `s-maxage=15` on a 1.5MB response still means one 1.5MB function invocation every 15 seconds per CDN region. If you have users across multiple regions, that's still significant transfer. Monitor after Phase 1 to see if this is sufficient.

### Step 2 (only if still over budget after Phase 1 + 2 + Step 1): Strip `image_data` from activity

Remove the `image_data` join from the activity query. In `api/activity.ts`, the query joins `tokens tok` and selects `tok.metadata->>'image_data' as image_data` (line 8). Remove both.

`ActivityItem.tsx` already has a fallback:

```tsx
<img src={item.image_data || '/collections/whale-town/collection_image.png'} ... />
```

Without `image_data`, every activity item shows the generic collection placeholder instead of the actual token thumbnail. Response drops from ~1.5MB to ~5KB.

**Tradeoff:** This is a visible UX downgrade. Every activity row looks identical since the thumbnail is the same placeholder image. The activity feed loses the visual variety that makes it scannable.

If we go with Step 2, a middle-ground improvement would be to lazy-load thumbnails on the frontend: render the placeholder immediately, then fetch the image via the 24h-cached `/api/collection/metadata` endpoint for visible items only.

**Files to change:**
- Step 1: `api/activity.ts` (add cache header only, already covered by Phase 1)
- Step 2: `api/activity.ts` (remove `image_data` join) + verify `src/components/ActivityItem.tsx` fallback

---

## Phase 4 - Reduce `/api/owners` Frequency (longer term)

The ownerMap is fetched on every TradePage load and wallet reconnect to power:
- "OWNED" badge on NFT cards
- Stale listing filtering (cross-reference seller vs current owner)

With Phase 1 caching (`s-maxage=60`), this becomes cheap. For a longer-term reduction, consider:

- Rebuilding `collection-data.json` off-chain periodically to include ownership data, eliminating the function call entirely for the OWNED badge use case.
- Moving stale listing detection fully server-side (indexer watches Transfer events and auto-cancels stale listings in DB). See memory note: `project_indexer_todo.md`.

**Files to change:** TBD - depends on approach chosen.

---

## Priority Order

1. **Phase 0** - Baseline measurement. 5 minutes. Required to validate everything that follows.
2. **Phase 1** - Cache headers on all endpoints. Biggest impact, zero risk, no logic changes. Should cut Fast Origin Transfer by 60-80%.
3. **Phase 2** - Strip `image_data` from listings + backfill via cached metadata endpoint. Biggest single endpoint fix. Requires frontend wiring in three places (useCollectionData fetchData, refreshListings, ProfilePage) but the metadata endpoint is already 24h cached.
4. **Phase 3 Step 1** - Activity cache header. Already done as part of Phase 1. Just measure the result.
5. **Phase 3 Step 2** - Strip `image_data` from activity feed. Only if still over budget after 1+2. Visible UX downgrade.
6. **Phase 4** - Fold ownership into static data or server-side indexer. Address as part of broader indexer work.

---

## Estimated Savings Summary

| Phase | Est. Transfer Reduction | Effort |
|---|---|---|
| Phase 0 (baseline) | Measurement only | 5 min |
| Phase 1 (cache headers) | 60-80% of current usage | 30 min |
| Phase 2 (strip listing images) | 90%+ of listings endpoint size | 1-2 hours |
| Phase 3 Step 1 (cache activity) | Collapses N users to 1 call/15s/region | Already done in Phase 1 |
| Phase 3 Step 2 (strip activity images) | 99% of activity endpoint size | 30 min |
| Phase 4 (owners optimization) | Eliminates ~200KB/load function call | TBD |

---

## Post-Implementation Validation

After each phase, check the Vercel dashboard to compare against the Phase 0 baseline:
1. Wait 24-48 hours for meaningful data
2. Compare daily Fast Origin Transfer to baseline
3. If Phase 1 alone brings usage well under the 10GB limit, Phase 2+ can be deprioritized
4. If still close to the limit after Phase 1+2, proceed to Phase 3 Step 2
