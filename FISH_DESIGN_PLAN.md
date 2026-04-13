# FishPage Redesign — Implementation Plan

## Summary

- **Scope:** Page redesign
- **Target:** `src/pages/FishPage.tsx`
- **Winner:** Variant F (refined B) — centered-stage tabbed shell
- **Supersedes:** Previous modal-based port plan in `~/.claude/plans/effervescent-gliding-church.md`. The GameScene component and hooks still port, but the modal-based Net/Shop/Journal UI is replaced with a tabbed in-card shell.

## Core design decisions

- **One glass card fills the page**; inside it: a thin header with 4 tabs + stats pills, and a swapping content region.
- **Tabs:** Ocean (default) · Net · Market · Journal. Active state = color underline + colored text (spring-animated `layoutId`). Inactive = `text-white/55`.
- **Stats pills** live in the header at all times (not just on Ocean). Points is primary (cyan-tinted bg); casts is secondary (neutral).
- **Ocean tab:** GameScene ocean + cast button. Subtle bottom gradient fade so the cast button lifts off the water.
- **Net tab:** 3-col grid of fish cards, rarity-tinted borders (Common white/10, Rare cyan/30, Epic purple/35, Legendary sun/40) + soft glow on non-commons. Sell button fills the card width. "Sell all" action in the section header.
- **Market tab:** Horizontal rows (icon tile left → name + desc center → price + buy right). No stacked cards.
- **Journal tab:** Auto-fill grid of rarity-locked squares, progress bar in the section header (purple → cyan gradient).
- **Motion:** 180ms fade/slide between tabs (opacity + 6px y-translate). Respects `prefers-reduced-motion` via motion/react defaults.

## Files to change

- [ ] `src/pages/FishPage.tsx` — rewrite to tabbed shell (NEW — replaces the modal-based version from the prior plan)
- [ ] `src/components/fish/GameScene.tsx` — port from reference folder, still needed for the Ocean tab content (see prior plan for style-fix details)
- [ ] `src/hooks/useFishGameState.ts` — port as-is from prior plan (localStorage-backed state; wallet removed)
- [ ] `src/lib/fishSoundService.ts` — port as-is from prior plan
- [ ] `src/constants/fishGameData.ts` — port as-is from prior plan
- [ ] `src/index.css` — add `--color-sun` and `--color-coral` tokens as prior plan spec'd
- [ ] `src/App.tsx` — `/fish` route + Fish nav button already enabled

## Implementation steps

1. **Port the 4 ancillary files** per the prior plan (useFishGameState, fishSoundService, fishGameData, GameScene). Skip the modal helpers in FishPage since we're not using modals.

2. **Build FishPage.tsx from scratch** using Variant F's structure (full source reproduced below). Wire the `CastButton` placeholder to the real `handleCast` from `useFishGameState`, and feed `GameScene` state (`gameState: 'idle' | 'casting' | 'waiting' | 'result'`, `caughtFish`, etc.) to the Ocean tab content.

3. **Wire each tab to live state:**
   - Ocean → render `<GameScene />` with props from `useFishGameState`, plus stats pills in header
   - Net → `inventory` from hook → map to fish cards; Sell button calls `sellFish(id)`; "Sell all" iterates `sellFish` over `inventory`
   - Market → render MARKET entries from `fishGameData`; Purchase button calls `buyTackleBox()` for the Supply Pack
   - Journal → map over `FISH_LIST` from `fishGameData`; each entry shows as found/locked based on `discoveredFishIds.has(id)`; progress bar computes `discoveredFishIds.size / FISH_LIST.length`

4. **Rarity tint map** — mirror the one from Variant F but use real rarity names from `fishGameData` (Common / Rare / Epic / Legendary). Apply to Net cards and optionally Journal unlocked cells.

5. **Header stat pills** — bind to `coins` (primary, Sparkles icon) and `attempts` (secondary, Zap icon).

6. **Dev-only "Grant Resources" button** — keep from the original port but gate behind `import.meta.env.DEV` and render as a tiny chip in the tab bar row (or drop from FishPage entirely and expose via URL query param — user preference).

7. **Delete the reference folder** `fish-ocean-quest-adventure-game/` when you're happy with the port.

## Component API

`FishPage` takes no props. Internal state:

- `activeTab: 'ocean' | 'net' | 'market' | 'journal'` — `useState<Tab>('ocean')`
- All game state is pulled from `useFishGameState()` — single source of truth for attempts, coins, inventory, discoveredFishIds, tackle-box-purchased, and mutators (`useAttempt`, `addFish`, `sellFish`, `buyTackleBox`, `grantTestResources`)

## Required UI states per tab

- **Ocean:**
  - Idle → cast button enabled (if `attempts > 0`)
  - Casting → cast button disabled, pulse animation on line
  - Waiting → dim the stage slightly, bubble/bite animation
  - Result → fish flies to net, toast "caught X"
  - Out of attempts → cast button disabled with hint "Buy supply pack"
- **Net:**
  - Empty (`inventory.length === 0`) → emoji + "No fish yet — cast a line" empty state
  - Populated → grid of rarity-tinted cards
- **Market:**
  - Supply Pack locked after purchase today → greyed-out card, "Available tomorrow"
  - Insufficient coins → buy button disabled + tooltip
- **Journal:**
  - Progress bar always visible
  - Locked cells → strong dim + `?`
  - Found cells → icon + subtle rarity tint on border

## Accessibility checklist

- [ ] Each tab button is `<button type="button">` with `aria-selected` and keyboard nav (left/right arrows cycle tabs)
- [ ] Tab panel has `role="tabpanel"` and `aria-labelledby` back to its button
- [ ] Stats pills use `aria-label` like "2,470 points" and "5 casts remaining"
- [ ] Cast button has clear disabled state + `aria-disabled` + hint when out of attempts
- [ ] Respects `prefers-reduced-motion`
- [ ] Min 44×44 touch targets on all interactive elements
- [ ] Focus-visible ring on tabs, cast button, sell/buy buttons
- [ ] Journal cells: locked ones have `aria-label="Undiscovered species"`; found ones have `aria-label="{name}"`

## Design tokens used

All existing — plus the `--color-sun` and `--color-coral` additions from the prior plan:

- **Accents:** `dream-cyan`, `dream-purple`, `sun`, `coral`
- **Surfaces:** `bg-white/5`, `bg-white/[0.025]`, `bg-white/[0.04]`, `border-white/10`, `border-white/[0.06]`
- **Text:** `text-dream-white`, `text-white/55`, `text-white/45`, `text-white/35`
- **Spacing:** `clamp()` rhythm — padding, gap, radius all driven by shared clamp tokens for fluid responsiveness

## Testing checklist

- [ ] `/fish` loads; Ocean tab is default
- [ ] Tab swap animates cleanly; active underline slides between tabs
- [ ] Cast line works → fish appears in Net → discovered in Journal
- [ ] Sell a fish → coins increase, fish gone from Net
- [ ] Buy Supply Pack → coins −100, attempts +10, Supply Pack locks
- [ ] Journal progress bar advances on new discovery
- [ ] Daily reset (`localStorage.ocean_quest_last_date = yesterday`, reload) → attempts reset, tackle-box lock clears
- [ ] Mobile viewport: tabs stay visible, stats pills may wrap but don't overflow the header
- [ ] `npm run lint` passes; no regressions on `/`, `/trade`, `/staking`, `/profile`

---

## Variant F — full source (scaffold for FishPage.tsx)

Use this as the starting skeleton. Replace `OceanStub` with `<GameScene />`, replace fixtures with live state from `useFishGameState`, and wire action handlers. Keep layout, spacing, and helper components (TabBtn, StatPill, SectionHead) verbatim.

```tsx
import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Anchor, Package, ShoppingBag, BookOpen, Sparkles } from 'lucide-react';

const FRAME_H = 'clamp(30rem, 58vh, 42rem)';
type Tab = 'ocean' | 'net' | 'market' | 'journal';

const RARITY_TINT: Record<string, { border: string; text: string; glow: string }> = {
  Common: { border: 'border-white/10', text: 'text-white/60', glow: '' },
  Rare: { border: 'border-dream-cyan/30', text: 'text-dream-cyan', glow: 'shadow-[0_0_24px_-8px_rgba(49,215,255,0.5)]' },
  Epic: { border: 'border-dream-purple/35', text: 'text-dream-purple', glow: 'shadow-[0_0_24px_-8px_rgba(167,139,250,0.5)]' },
  Legendary: { border: 'border-sun/40', text: 'text-sun', glow: 'shadow-[0_0_28px_-6px_rgba(251,191,36,0.45)]' },
};

export default function FishPage() {
  const [tab, setTab] = useState<Tab>('ocean');

  // TODO: const { attempts, coins, inventory, discoveredFishIds, ... } = useFishGameState();
  const POINTS = 2470;
  const CASTS = 5;
  const JOURNAL_TOTAL = 70;
  const JOURNAL_FOUND = 12;

  return (
    <div className="w-full">
      <div
        className="border border-white/10 bg-white/5 backdrop-blur-xl flex flex-col overflow-hidden"
        style={{ borderRadius: 'clamp(1.25rem, 1.75vw, 1.75rem)', height: FRAME_H }}
      >
        {/* Header: tabs + stats */}
        <div
          className="flex items-center justify-between border-b border-white/[0.06]"
          style={{ padding: 'clamp(0.6rem, 1.1vh, 0.9rem) clamp(0.85rem, 1.5vw, 1.25rem)' }}
        >
          <nav className="flex items-center" style={{ gap: 'clamp(0.1rem, 0.25vw, 0.3rem)' }}>
            <TabBtn icon={Anchor} label="Ocean" active={tab === 'ocean'} onClick={() => setTab('ocean')} accent="cyan" />
            <TabBtn icon={Package} label="Net" count={/* inventory.length */ 3} active={tab === 'net'} onClick={() => setTab('net')} accent="cyan" />
            <TabBtn icon={ShoppingBag} label="Market" count={2} active={tab === 'market'} onClick={() => setTab('market')} accent="sun" />
            <TabBtn icon={BookOpen} label="Journal" count={`${JOURNAL_FOUND}/${JOURNAL_TOTAL}`} active={tab === 'journal'} onClick={() => setTab('journal')} accent="purple" />
          </nav>

          <div className="flex items-center" style={{ gap: 'clamp(0.4rem, 0.7vw, 0.6rem)' }}>
            <StatPill primary icon={<Sparkles size={10} className="text-dream-cyan" fill="currentColor" />} value={POINTS.toLocaleString()} label="pts" />
            <StatPill icon={<Zap size={10} className="text-dream-cyan" fill="currentColor" />} value={`${CASTS}`} label="casts" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {tab === 'ocean' && (
              <motion.div key="ocean" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="absolute inset-0">
                {/* TODO: <GameScene ...props /> */}
                <div className="absolute left-0 right-0 bottom-0 pointer-events-none h-32 bg-gradient-to-t from-ocean-deep/60 to-transparent" />
                <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 'clamp(1.5rem, 3.5vh, 2.75rem)' }}>
                  {/* Cast button — wire to handleCast */}
                </div>
              </motion.div>
            )}

            {tab === 'net' && (
              <motion.div key="net" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="absolute inset-0 overflow-y-auto" style={{ padding: 'clamp(1.1rem, 2vw, 1.75rem)' }}>
                <SectionHead eyebrow="Your net" title={`${/* inventory.length */ 3} fish`} sub="Tap sell to convert to points" action={<SellAllBtn />} />
                <div className="grid grid-cols-3" style={{ gap: 'clamp(0.6rem, 1.2vw, 0.9rem)' }}>
                  {/* inventory.map(f => <FishCard />) */}
                </div>
              </motion.div>
            )}

            {tab === 'market' && (
              <motion.div key="market" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="absolute inset-0 overflow-y-auto" style={{ padding: 'clamp(1.1rem, 2vw, 1.75rem)' }}>
                <SectionHead eyebrow="Market" title="Supplies & bait" sub="Restock your next cast" />
                <div className="flex flex-col" style={{ gap: 'clamp(0.6rem, 1.2vh, 0.85rem)' }}>
                  {/* MARKET.map(item => <MarketRow />) */}
                </div>
              </motion.div>
            )}

            {tab === 'journal' && (
              <motion.div key="journal" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="absolute inset-0 overflow-y-auto" style={{ padding: 'clamp(1.1rem, 2vw, 1.75rem)' }}>
                <SectionHead
                  eyebrow="Journal"
                  title={`${JOURNAL_FOUND} of ${JOURNAL_TOTAL} discovered`}
                  sub="Every species unlocks lore"
                  action={
                    <div className="flex items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.03]" style={{ height: 'clamp(1.4rem, 2.5vh, 1.75rem)', width: 'clamp(6rem, 10vw, 9rem)' }}>
                      <div className="h-full bg-gradient-to-r from-dream-purple/70 to-dream-cyan/70" style={{ width: `${(JOURNAL_FOUND / JOURNAL_TOTAL) * 100}%` }} />
                    </div>
                  }
                />
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(3rem, 4.5vw, 4rem), 1fr))', gap: 'clamp(0.45rem, 0.9vw, 0.7rem)' }}>
                  {/* JOURNAL.map(f => <JournalCell found={f.found} icon={f.icon} />) */}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ icon: Icon, label, count, active, onClick, accent }: { icon: any; label: string; count?: number | string; active: boolean; onClick: () => void; accent: 'cyan' | 'sun' | 'purple' }) {
  const accentColor = accent === 'cyan' ? 'text-dream-cyan' : accent === 'sun' ? 'text-sun' : 'text-dream-purple';
  const accentBg = accent === 'cyan' ? 'bg-dream-cyan' : accent === 'sun' ? 'bg-sun' : 'bg-dream-purple';
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center font-medium transition-colors ${active ? accentColor : 'text-white/55 hover:text-white/85'}`}
      style={{ padding: 'clamp(0.55rem, 1.1vh, 0.8rem) clamp(0.75rem, 1.2vw, 1rem)', fontSize: 'clamp(11px, 0.85vw, 13px)', gap: 'clamp(0.4rem, 0.6vw, 0.5rem)' }}
    >
      <Icon size={14} />
      <span>{label}</span>
      {count !== undefined && (
        <span className={`font-mono ${active ? 'text-white/50' : 'text-white/30'}`} style={{ fontSize: 'clamp(10px, 0.75vw, 11px)', marginLeft: 2 }}>
          {count}
        </span>
      )}
      {active && (
        <motion.span
          layoutId="fishpage-tab-underline"
          className={`absolute left-2 right-2 ${accentBg}`}
          style={{ bottom: -1, height: 2, borderRadius: 2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        />
      )}
    </button>
  );
}

function StatPill({ icon, value, label, primary = false }: { icon: ReactNode; value: string; label: string; primary?: boolean }) {
  return (
    <span
      className={`rounded-full flex items-center gap-2 font-mono backdrop-blur-md transition-colors ${primary ? 'border border-dream-cyan/25 bg-dream-cyan/[0.08] text-dream-white' : 'border border-white/10 bg-white/[0.04] text-white/70'}`}
      style={{ fontSize: 'clamp(10px, 0.8vw, 12px)', padding: 'clamp(5px, 0.65vh, 7px) clamp(10px, 1.1vw, 14px)' }}
    >
      {icon}
      <span className="font-bold">{value}</span>
      <span className="text-white/35 uppercase tracking-[0.15em] font-bold" style={{ fontSize: 'clamp(8px, 0.65vw, 10px)' }}>{label}</span>
    </span>
  );
}

function SectionHead({ eyebrow, title, sub, action }: { eyebrow: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between" style={{ marginBottom: 'clamp(0.9rem, 1.8vh, 1.35rem)', gap: 'clamp(0.75rem, 1.5vw, 1.25rem)' }}>
      <div className="min-w-0">
        <div className="font-mono text-white/40 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(9px, 0.7vw, 11px)', marginBottom: 'clamp(0.2rem, 0.4vh, 0.35rem)' }}>{eyebrow}</div>
        <h3 className="font-bold font-sans tracking-tight text-dream-white" style={{ fontSize: 'clamp(1rem, 1.3vw, 1.35rem)', lineHeight: 1.15 }}>{title}</h3>
        {sub && <p className="text-white/45" style={{ fontSize: 'clamp(11px, 0.85vw, 13px)', marginTop: 'clamp(0.15rem, 0.3vh, 0.25rem)' }}>{sub}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

function SellAllBtn() {
  return (
    <button
      className="border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-dream-white font-mono font-bold transition-colors"
      style={{ fontSize: 'clamp(10px, 0.8vw, 12px)', padding: 'clamp(0.5rem, 0.9vh, 0.7rem) clamp(0.85rem, 1.3vw, 1.1rem)', borderRadius: 'clamp(0.5rem, 0.7vw, 0.65rem)', letterSpacing: '0.08em' }}
    >
      Sell all
    </button>
  );
}
```

---

*Generated by design-lab skill · 2026-04-13*
