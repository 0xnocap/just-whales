import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Anchor,
  Package,
  ShoppingBag,
  BookOpen,
  Zap,
  Sparkles,
  Volume2,
  VolumeX,
  Coins,
} from 'lucide-react';
import { useFishGameState } from '../hooks/useFishGameState';
import GameScene from '../components/fish/GameScene';
import { FISH_LIST, TACKLE_BOX_COST, TACKLE_BOX_ATTEMPTS } from '../constants/fishGameData';
import { soundManager } from '../lib/fishSoundService';

const FRAME_H = 'clamp(32rem, 64vh, 46rem)';

type Tab = 'ocean' | 'net' | 'market' | 'journal';
type Accent = 'cyan' | 'sun' | 'purple';

const RARITY_TINT: Record<string, { border: string; text: string; glow: string; chip: string }> = {
  Common: {
    border: 'border-white/10',
    text: 'text-white/60',
    glow: '',
    chip: 'bg-white/[0.04] text-white/60',
  },
  Junk: {
    border: 'border-white/[0.06]',
    text: 'text-white/40',
    glow: '',
    chip: 'bg-white/[0.03] text-white/40',
  },
  Uncommon: {
    border: 'border-sun/25',
    text: 'text-sun',
    glow: 'shadow-[0_0_20px_-10px_rgba(251,191,36,0.4)]',
    chip: 'bg-sun/10 text-sun',
  },
  Rare: {
    border: 'border-dream-cyan/30',
    text: 'text-dream-cyan',
    glow: 'shadow-[0_0_24px_-8px_rgba(34,211,238,0.5)]',
    chip: 'bg-dream-cyan/10 text-dream-cyan',
  },
  Epic: {
    border: 'border-dream-purple/35',
    text: 'text-dream-purple',
    glow: 'shadow-[0_0_24px_-8px_rgba(192,132,252,0.5)]',
    chip: 'bg-dream-purple/10 text-dream-purple',
  },
  'Ultra Rare': {
    border: 'border-dream-purple/45',
    text: 'text-dream-purple',
    glow: 'shadow-[0_0_28px_-6px_rgba(192,132,252,0.6)]',
    chip: 'bg-dream-purple/15 text-dream-purple',
  },
  Legendary: {
    border: 'border-sun/40',
    text: 'text-sun',
    glow: 'shadow-[0_0_28px_-6px_rgba(251,191,36,0.55)]',
    chip: 'bg-sun/15 text-sun',
  },
  NFT: {
    border: 'border-dream-purple/50',
    text: 'text-dream-purple',
    glow: 'shadow-[0_0_32px_-6px_rgba(192,132,252,0.6)]',
    chip: 'bg-dream-purple/15 text-dream-purple',
  },
};

function tint(rarity: string) {
  return RARITY_TINT[rarity] ?? RARITY_TINT.Common;
}

export default function FishPage() {
  const {
    attempts,
    coins,
    inventory,
    discoveredFishIds,
    hasPurchasedTackleBox,
    useAttempt,
    addFish,
    sellFish,
    buyTackleBox,
    grantTestResources,
  } = useFishGameState();

  const [tab, setTab] = useState<Tab>('ocean');
  const [isMuted, setIsMuted] = useState(soundManager.isMuted());

  const journalFound = discoveredFishIds.length;
  const journalTotal = FISH_LIST.length;
  const journalPct = (journalFound / journalTotal) * 100;

  return (
    <div className="w-full">
      <div
        className="border border-white/10 bg-white/5 backdrop-blur-xl flex flex-col overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.45)]"
        style={{ borderRadius: 'clamp(1.25rem, 1.75vw, 1.75rem)', height: FRAME_H }}
      >
        {/* Top glow */}
        <div className="relative h-[1px] bg-gradient-to-r from-transparent via-dream-cyan/40 to-transparent" />

        {/* Header: tabs + stats */}
        <div
          className="flex items-center justify-between border-b border-white/[0.06] flex-wrap"
          style={{
            padding: 'clamp(0.6rem, 1.1vh, 0.9rem) clamp(0.85rem, 1.5vw, 1.25rem)',
            gap: 'clamp(0.5rem, 1vw, 0.75rem)',
          }}
        >
          <nav
            role="tablist"
            aria-label="Fishing navigation"
            className="flex items-center"
            style={{ gap: 'clamp(0.1rem, 0.25vw, 0.3rem)' }}
          >
            <TabBtn
              id="ocean"
              icon={Anchor}
              label="Ocean"
              active={tab === 'ocean'}
              onClick={() => setTab('ocean')}
              accent="cyan"
            />
            <TabBtn
              id="net"
              icon={Package}
              label="Net"
              count={inventory.length}
              active={tab === 'net'}
              onClick={() => setTab('net')}
              accent="cyan"
            />
            <TabBtn
              id="market"
              icon={ShoppingBag}
              label="Market"
              active={tab === 'market'}
              onClick={() => setTab('market')}
              accent="sun"
            />
            <TabBtn
              id="journal"
              icon={BookOpen}
              label="Journal"
              count={`${journalFound}/${journalTotal}`}
              active={tab === 'journal'}
              onClick={() => setTab('journal')}
              accent="purple"
            />
          </nav>

          <div className="flex items-center" style={{ gap: 'clamp(0.4rem, 0.7vw, 0.6rem)' }}>
            <StatPill
              primary
              icon={<Coins size={11} className="text-sun" fill="currentColor" />}
              value={coins.toLocaleString()}
              label="coins"
              aria={`${coins} coins`}
            />
            <StatPill
              icon={<Zap size={10} className="text-dream-cyan" fill="currentColor" />}
              value={`${attempts}`}
              label="casts"
              aria={`${attempts} casts remaining`}
            />
            <button
              onClick={() => setIsMuted(soundManager.toggleMute())}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white transition-colors flex items-center justify-center"
              style={{
                width: 'clamp(1.65rem, 2.4vw, 2rem)',
                height: 'clamp(1.65rem, 2.4vw, 2rem)',
              }}
            >
              {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 relative overflow-hidden"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
        >
          <AnimatePresence mode="wait">
            {tab === 'ocean' && (
              <motion.div
                key="ocean"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0"
              >
                <GameScene onCatch={addFish} useAttempt={useAttempt} attempts={attempts} />
              </motion.div>
            )}

            {tab === 'net' && (
              <motion.div
                key="net"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 overflow-y-auto"
                style={{ padding: 'clamp(1.1rem, 2vw, 1.75rem)' }}
              >
                <SectionHead
                  eyebrow="Your net"
                  title={inventory.length === 0 ? 'Empty' : `${inventory.length} caught`}
                  sub="Sell non-NFT catches for coins. NFTs are claimable."
                />

                {inventory.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="No fish yet"
                    body="Cast a line in the Ocean tab to start filling your net."
                  />
                ) : (
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(10rem, 16vw, 13rem), 1fr))',
                      gap: 'clamp(0.65rem, 1.2vw, 0.95rem)',
                    }}
                  >
                    {inventory.map((item, idx) => {
                      const t = tint(item.rarity);
                      const isNft = item.rarity === 'NFT';
                      return (
                        <div
                          key={`${item.id}-${idx}`}
                          className={`relative flex flex-col items-center text-center border ${t.border} bg-white/[0.025] ${t.glow} transition-colors hover:bg-white/[0.045]`}
                          style={{
                            padding: 'clamp(0.9rem, 1.6vw, 1.25rem)',
                            borderRadius: 'clamp(0.75rem, 1vw, 1rem)',
                          }}
                        >
                          <span
                            className={`absolute ${t.text} font-mono font-bold uppercase tracking-[0.15em]`}
                            style={{
                              top: 'clamp(0.5rem, 0.9vh, 0.7rem)',
                              left: 'clamp(0.65rem, 1vw, 0.85rem)',
                              fontSize: 'clamp(8px, 0.65vw, 10px)',
                            }}
                          >
                            {isNft ? `${item.nftTier} NFT` : item.rarity}
                          </span>
                          <span
                            style={{
                              fontSize: 'clamp(2.25rem, 3.6vw, 3rem)',
                              marginTop: 'clamp(0.65rem, 1.3vh, 1rem)',
                            }}
                          >
                            {item.icon}
                          </span>
                          <div
                            className="font-bold text-dream-white"
                            style={{
                              fontSize: 'clamp(12px, 0.95vw, 14px)',
                              marginTop: 'clamp(0.5rem, 1vh, 0.75rem)',
                            }}
                          >
                            {item.name}
                          </div>
                          {!isNft && (
                            <div
                              className="flex items-center gap-1.5 text-white/50 font-mono"
                              style={{
                                fontSize: 'clamp(10px, 0.8vw, 12px)',
                                marginTop: 'clamp(0.2rem, 0.4vh, 0.3rem)',
                              }}
                            >
                              <Coins size={10} className="text-sun" fill="currentColor" />
                              <span className="text-sun/90">{item.value}</span>
                            </div>
                          )}
                          {isNft ? (
                            <button
                              className="w-full bg-dream-purple/15 hover:bg-dream-purple/25 border border-dream-purple/40 text-dream-purple font-mono font-bold transition-colors"
                              style={{
                                fontSize: 'clamp(10px, 0.8vw, 12px)',
                                padding: 'clamp(0.5rem, 1vh, 0.7rem)',
                                borderRadius: 'clamp(0.5rem, 0.7vw, 0.65rem)',
                                marginTop: 'clamp(0.85rem, 1.7vh, 1.15rem)',
                                letterSpacing: '0.08em',
                              }}
                            >
                              Claim
                            </button>
                          ) : (
                            <button
                              onClick={() => sellFish(item.id)}
                              className="w-full bg-white/[0.04] hover:bg-dream-cyan/15 border border-white/10 hover:border-dream-cyan/40 text-white/80 hover:text-dream-cyan font-mono font-bold transition-colors"
                              style={{
                                fontSize: 'clamp(10px, 0.8vw, 12px)',
                                padding: 'clamp(0.5rem, 1vh, 0.7rem)',
                                borderRadius: 'clamp(0.5rem, 0.7vw, 0.65rem)',
                                marginTop: 'clamp(0.85rem, 1.7vh, 1.15rem)',
                                letterSpacing: '0.08em',
                              }}
                            >
                              Sell
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'market' && (
              <motion.div
                key="market"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 overflow-y-auto"
                style={{ padding: 'clamp(1.1rem, 2vw, 1.75rem)' }}
              >
                <SectionHead
                  eyebrow="Market"
                  title="Supplies & bait"
                  sub="Restock before your next cast"
                />
                <div className="flex flex-col" style={{ gap: 'clamp(0.6rem, 1.2vh, 0.85rem)' }}>
                  <MarketRow
                    icon="📦"
                    name="Supply Pack"
                    desc={`+${TACKLE_BOX_ATTEMPTS} casts today · one per day`}
                    price={TACKLE_BOX_COST}
                    disabled={hasPurchasedTackleBox || coins < TACKLE_BOX_COST}
                    disabledLabel={
                      hasPurchasedTackleBox
                        ? 'Sold out · back tomorrow'
                        : coins < TACKLE_BOX_COST
                        ? 'Not enough coins'
                        : undefined
                    }
                    onBuy={buyTackleBox}
                  />
                </div>
              </motion.div>
            )}

            {tab === 'journal' && (
              <motion.div
                key="journal"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 overflow-y-auto"
                style={{ padding: 'clamp(1.1rem, 2vw, 1.75rem)' }}
              >
                <SectionHead
                  eyebrow="Journal"
                  title={`${journalFound} of ${journalTotal} discovered`}
                  sub="Every species unlocks lore"
                  action={
                    <div
                      className="flex items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.03]"
                      style={{
                        height: 'clamp(1.4rem, 2.5vh, 1.75rem)',
                        width: 'clamp(8rem, 12vw, 11rem)',
                      }}
                      aria-label={`Progress: ${Math.round(journalPct)} percent`}
                    >
                      <div
                        className="h-full bg-gradient-to-r from-dream-purple/70 to-dream-cyan/70"
                        style={{ width: `${journalPct}%` }}
                      />
                    </div>
                  }
                />
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(3.5rem, 5.5vw, 4.5rem), 1fr))',
                    gap: 'clamp(0.45rem, 0.9vw, 0.7rem)',
                  }}
                >
                  {FISH_LIST.map(f => {
                    const found = discoveredFishIds.includes(f.id);
                    const t = tint(f.rarity);
                    return (
                      <div
                        key={f.id}
                        aria-label={found ? `${f.name}, ${f.rarity}` : 'Undiscovered species'}
                        className={`aspect-square flex flex-col items-center justify-center border transition-colors ${
                          found
                            ? `${t.border} bg-white/[0.04] hover:bg-white/[0.07]`
                            : 'border-white/[0.05] bg-black/15 text-white/15'
                        }`}
                        style={{
                          borderRadius: 'clamp(0.55rem, 0.8vw, 0.75rem)',
                          padding: 'clamp(0.25rem, 0.5vh, 0.4rem)',
                        }}
                      >
                        <span style={{ fontSize: 'clamp(1.25rem, 2vw, 1.75rem)' }}>
                          {found ? f.icon : '?'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Dev-only grant button */}
      {(import.meta as any).env?.DEV && (
        <div className="flex justify-center" style={{ marginTop: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>
          <button
            onClick={grantTestResources}
            className="flex items-center gap-2 border border-dream-purple/40 bg-dream-purple/10 hover:bg-dream-purple/20 text-dream-purple font-mono font-bold uppercase tracking-[0.2em] transition-colors"
            style={{
              fontSize: 'clamp(9px, 0.7vw, 11px)',
              padding: 'clamp(0.4rem, 0.7vh, 0.55rem) clamp(0.85rem, 1.3vw, 1.1rem)',
              borderRadius: 'clamp(0.5rem, 0.7vw, 0.65rem)',
            }}
          >
            <Sparkles size={12} /> Dev · Grant 999 casts + coins
          </button>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  id,
  icon: Icon,
  label,
  count,
  active,
  onClick,
  accent,
}: {
  id: string;
  icon: any;
  label: string;
  count?: number | string;
  active: boolean;
  onClick: () => void;
  accent: Accent;
}) {
  const accentColor =
    accent === 'cyan' ? 'text-dream-cyan' : accent === 'sun' ? 'text-sun' : 'text-dream-purple';
  const accentBg =
    accent === 'cyan' ? 'bg-dream-cyan' : accent === 'sun' ? 'bg-sun' : 'bg-dream-purple';
  return (
    <button
      id={`tab-${id}`}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative flex items-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded ${
        active ? accentColor : 'text-white/55 hover:text-white/85'
      }`}
      style={{
        padding: 'clamp(0.55rem, 1.1vh, 0.8rem) clamp(0.75rem, 1.2vw, 1rem)',
        fontSize: 'clamp(11px, 0.85vw, 13px)',
        gap: 'clamp(0.4rem, 0.6vw, 0.5rem)',
      }}
    >
      <Icon size={14} />
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`font-mono ${active ? 'text-white/50' : 'text-white/30'}`}
          style={{ fontSize: 'clamp(10px, 0.75vw, 11px)', marginLeft: 2 }}
        >
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

function StatPill({
  icon,
  value,
  label,
  primary = false,
  aria,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  primary?: boolean;
  aria?: string;
}) {
  return (
    <span
      aria-label={aria}
      className={`rounded-full flex items-center gap-2 font-mono backdrop-blur-md transition-colors ${
        primary
          ? 'border border-sun/30 bg-sun/[0.08] text-dream-white'
          : 'border border-white/10 bg-white/[0.04] text-white/70'
      }`}
      style={{
        fontSize: 'clamp(10px, 0.8vw, 12px)',
        padding: 'clamp(5px, 0.65vh, 7px) clamp(10px, 1.1vw, 14px)',
      }}
    >
      {icon}
      <span className="font-bold">{value}</span>
      <span
        className="text-white/35 uppercase tracking-[0.15em] font-bold"
        style={{ fontSize: 'clamp(8px, 0.65vw, 10px)' }}
      >
        {label}
      </span>
    </span>
  );
}

function SectionHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex items-end justify-between"
      style={{
        marginBottom: 'clamp(0.9rem, 1.8vh, 1.35rem)',
        gap: 'clamp(0.75rem, 1.5vw, 1.25rem)',
      }}
    >
      <div className="min-w-0">
        <div
          className="font-mono text-white/40 uppercase tracking-[0.15em]"
          style={{
            fontSize: 'clamp(9px, 0.7vw, 11px)',
            marginBottom: 'clamp(0.2rem, 0.4vh, 0.35rem)',
          }}
        >
          {eyebrow}
        </div>
        <h3
          className="font-bold font-sans tracking-tight text-dream-white"
          style={{ fontSize: 'clamp(1rem, 1.3vw, 1.35rem)', lineHeight: 1.15 }}
        >
          {title}
        </h3>
        {sub && (
          <p
            className="text-white/45"
            style={{
              fontSize: 'clamp(11px, 0.85vw, 13px)',
              marginTop: 'clamp(0.15rem, 0.3vh, 0.25rem)',
            }}
          >
            {sub}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

function MarketRow({
  icon,
  name,
  desc,
  price,
  disabled,
  disabledLabel,
  onBuy,
}: {
  icon: string;
  name: string;
  desc: string;
  price: number;
  disabled: boolean;
  disabledLabel?: string;
  onBuy: () => void;
}) {
  return (
    <div
      className="flex items-center border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.04] transition-colors"
      style={{
        padding: 'clamp(0.85rem, 1.5vw, 1.15rem)',
        borderRadius: 'clamp(0.75rem, 1vw, 1rem)',
        gap: 'clamp(0.9rem, 1.6vw, 1.25rem)',
      }}
    >
      <div
        className="flex items-center justify-center rounded-[0.85rem] bg-gradient-to-br from-sun/10 to-sun/[0.02] border border-sun/20 flex-shrink-0"
        style={{
          width: 'clamp(3rem, 4.5vw, 3.75rem)',
          height: 'clamp(3rem, 4.5vw, 3.75rem)',
          fontSize: 'clamp(1.6rem, 2.5vw, 2rem)',
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-bold text-dream-white"
          style={{ fontSize: 'clamp(13px, 1vw, 15px)' }}
        >
          {name}
        </div>
        <div
          className="text-white/50"
          style={{ fontSize: 'clamp(11px, 0.85vw, 13px)', marginTop: 2 }}
        >
          {desc}
        </div>
      </div>
      <div
        className="flex items-center flex-shrink-0"
        style={{ gap: 'clamp(0.6rem, 1vw, 0.9rem)' }}
      >
        <span className="flex items-center gap-1.5">
          <Coins size={13} className="text-sun" fill="currentColor" />
          <span
            className="font-mono font-bold text-sun"
            style={{ fontSize: 'clamp(13px, 1vw, 15px)' }}
          >
            {price}
          </span>
        </span>
        <button
          onClick={onBuy}
          disabled={disabled}
          aria-disabled={disabled}
          title={disabledLabel}
          className="border border-sun/40 bg-sun/10 hover:bg-sun/20 text-sun font-mono font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-sun/10"
          style={{
            fontSize: 'clamp(10px, 0.8vw, 12px)',
            padding: 'clamp(0.5rem, 0.9vh, 0.7rem) clamp(0.9rem, 1.4vw, 1.2rem)',
            borderRadius: 'clamp(0.5rem, 0.7vw, 0.65rem)',
            letterSpacing: '0.08em',
          }}
        >
          {disabled ? 'Unavailable' : 'Buy'}
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: any;
  title: string;
  body: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center border border-white/[0.06] bg-white/[0.015] mx-auto"
      style={{
        padding: 'clamp(2rem, 5vh, 3.5rem) clamp(1.5rem, 3vw, 2.5rem)',
        borderRadius: 'clamp(0.85rem, 1.2vw, 1.1rem)',
        maxWidth: 'clamp(18rem, 40vw, 26rem)',
      }}
    >
      <div
        className="flex items-center justify-center border border-white/10 bg-white/[0.04] text-white/40"
        style={{
          width: 'clamp(2.5rem, 3.5vw, 3rem)',
          height: 'clamp(2.5rem, 3.5vw, 3rem)',
          borderRadius: 'clamp(0.6rem, 0.8vw, 0.75rem)',
          marginBottom: 'clamp(0.75rem, 1.5vh, 1rem)',
        }}
      >
        <Icon size={18} />
      </div>
      <div
        className="font-bold text-dream-white"
        style={{ fontSize: 'clamp(13px, 1vw, 15px)' }}
      >
        {title}
      </div>
      <p
        className="text-white/45"
        style={{
          fontSize: 'clamp(11px, 0.85vw, 13px)',
          marginTop: 'clamp(0.3rem, 0.6vh, 0.45rem)',
        }}
      >
        {body}
      </p>
    </div>
  );
}
