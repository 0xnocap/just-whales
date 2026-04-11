# Mobile Design Plan — Variant C

**Target:** `src/App.tsx` → `TradePage`
**Scope:** Mobile-only responsive changes. Desktop layout is untouched.
**Pattern:** Variant C — Full-width segmented control + contextual row + bottom sheet filter.

---

## Step 1: Banner — Tab-adaptive layout (mobile only)

Currently the banner always shows the same layout with only Floor + Listed stats.

**Mobile — Items tab:**
- Left: avatar + name + badge + description (same structure as desktop)
- Right: 2×2 stats grid — Floor, Listed, Volume, Holders

**Mobile — Activity tab:**
- Top row: smaller avatar + name + badge inline, "Live" pill on the right
- Stat strip: Floor | Listed | Volume | Holders — 4 equal columns with hairline dividers

**How:** Wrap the existing banner stats section in `hidden md:flex`. Add a `md:hidden` block that conditionally renders the Items or Activity layout based on `activeTradeTab`. The gradient background and identity elements are shared.

---

## Step 2: Toolbar — Two-row layout (mobile only)

Currently all controls are in a single `flex` row at `sticky top-[52px]`. On mobile this overflows the viewport.

**Mobile toolbar — Row 1:**
Full-width segmented pill spanning the entire toolbar width:
```
[ ▦ Items         ◉ Activity ]
```

**Mobile toolbar — Row 2 (contextual):**
- Items tab: `[ 🔍 Search ·············· ] [ Filter ] [ ⚡ Sweep ]`
- Activity tab: `[ All ] [ Sales ] [ Listed ] [ Transfers ]` — horizontally scrollable chips

**Desktop toolbar:** Completely unchanged — keep existing `flex items-center gap-4` row.

**How:**
- Wrap existing desktop content in `hidden md:flex items-center gap-4 w-full`
- Add `flex md:hidden flex-col gap-2` wrapper for mobile rows
- Both share the same state (activeTradeTab, filter, searchQuery, sweepMode, etc.)

---

## Step 3: Filter bottom sheet (mobile only)

Currently `showFilters` toggles an inline panel that expands above the grid. On mobile this displaces content awkwardly.

**Mobile:** Filter button opens a `fixed` bottom sheet that slides up from the bottom of the screen.

Sheet contents (mirrors current desktop filter panel):
- **Status:** All | Listed | Unlisted (row of chips)
- **Sort:** Price ↑ | Price ↓ | Rarity | Token ID (2×2 grid)
- **Traits:** One section per trait category, chips for each value

**Desktop:** Existing `showFilters` inline panel — unchanged.

**How:**
- Add `showMobileFilterSheet` state (boolean)
- Mobile Filter button sets `showMobileFilterSheet(true)` instead of `setShowFilters`
- Render `fixed inset-0 z-50` overlay + `fixed bottom-0` sheet — both `md:hidden`
- Sheet reuses the same `selectedTraits`, `filter`, `sort` state as the desktop panel

---

## Step 4: Stats data

The banner currently shows only Floor + Listed. Volume and Holders are already in `collectionData`. Verify the fields and surface them in the mobile banner.

Fields to confirm in `collectionData`:
- `floor` — already used
- `listed` — already used
- `totalVolume` or equivalent — check API response shape
- `holders` — check API response shape

---

## Notes

- All mobile changes use `md:hidden` / `hidden md:flex` — zero risk to desktop.
- `sweepMode` on mobile: the existing sweep bar (slides up from bottom, replaces nav) already works correctly on mobile. No changes needed there.
- `showActivity` (live sidebar toggle) is desktop-only — hide the Live button on mobile toolbar since activity is its own full tab on mobile.
- The floating pill nav is already correct and stays as-is.
