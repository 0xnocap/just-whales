# TradePage Redesign — Variant F Implementation Plan

Approved direction from design lab (Variant F). This covers only the TradePage visual changes — no behavior changes, no new features.

---

## What's Changing

### 1. Banner

**Current:** Banner has avatar + name centered vertically in the middle of the banner.

**New:** Content pinned to the **bottom of the banner**.
- Bottom-left: collection image (avatar) + "Whale Town" + verified badge + description
- Bottom-right: Floor / Listed / Holders / Volume stats as plain text (no glow, no accent colors — all white)
- Background: same ocean-deep gradient, no pixel grid overlay
- Avatar box shadow stays (subtle glow on the image border only, not text)
- Min height: ~240px so there's breathing room above the content

**Key changes in App.tsx TradePage banner section:**
- Change `flex items-center` to `absolute bottom-0 left-0 right-0 flex items-end justify-between`
- Avatar moves into a `flex items-end gap-4` group with name/description
- Stats move to a separate `flex items-end gap-5` block on the right
- Remove any `textShadow` from stat values
- Remove pixel grid `div` if present

---

### 2. Toolbar (sticky row below banner)

**Current:** Tab switcher (Items/Activity) on its own line, then filter bar on another line below.

**New:** Single sticky toolbar row containing everything:
```
[Items | Activity]  |  [All / Listed / Unlisted]  [Filters]  [Sort ▾]  [Search — flex-1]  [Live]  [Sweep]
```

- Items/Activity tabs: pill group on the far left
- Divider
- Status filter (All/Listed/Unlisted): pill group — only visible when Items tab active
- Filters button: only when Items tab active
- Sort dropdown: only when Items tab active, hidden on small screens
- Search input: `flex-1`, grows to fill — only when Items tab active
- Live toggle: toggles the activity sidebar card — only when Items tab active
- Sweep button: dream-cyan CTA, always slightly glowing, far right — only when Items tab active
- When Activity tab active: just the tabs + activity filter chips (All / Sales / Listed / Transfers)

---

### 3. Activity Sidebar (Live card)

**Current:** Full panel that pushes content.

**New:** Styled `w-72` card that appears to the right of the grid when "Live" is toggled.
- Sticky (`sticky top-[53px]`)
- Max height `calc(100vh - 80px)`, scrollable internally
- Card header: "Live Activity" label + X close button
- Filter chips inside the card: All / Sales / Listed / Transfers
- Uses the same `ActivityItem` component / same data

---

### 4. Background

No change needed — current `#083344` ocean-deep background is already correct.

---

## Files to Edit

| File | Change |
|---|---|
| `src/App.tsx` | Banner layout, toolbar collapse, sidebar card |

No new files needed. All changes are within the existing TradePage section of App.tsx.

---

## Implementation Order

1. Banner — reposition content to bottom-left / bottom-right
2. Toolbar — collapse two rows into one sticky row
3. Sidebar — convert panel to a styled card alongside the grid

Each step is independent and testable on its own.
