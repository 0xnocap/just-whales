import { useState, useEffect, type ReactNode } from 'react';
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
  XCircle,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useFishGameServer } from '../hooks/useFishGameServer';
import GameScene from '../components/fish/GameScene';
import { FISH_LIST, OCEAN_TREASURES, TACKLE_BOX_COST } from '../constants/fishGameData';
import { soundManager } from '../lib/fishSoundService';
import { Link } from 'react-router-dom';

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
  const { isConnected } = useAccount();
  const {
    state,
    loading,
    isPurchasing,
    sellingId,
    onChainOPBalance,
    cast,
    sell,
    buyTackleBox,
    grantTestResources,
  } = useFishGameServer();

  const [tab, setTab] = useState<Tab>('ocean');
  const [isMuted, setIsMuted] = useState(soundManager.isMuted());

  const inventory = state?.inventory || [];
  const attempts = state?.castsRemaining ?? 0;
  const discoveredFishIds = state?.discoveredFishIds || [];
  const coins = state ? Number(BigInt(state.unclaimedFishingOP) / BigInt(10**18)) : 0;
  const OP_DECIMALS = BigInt(10) ** BigInt(18);
  // null = still loading, number = resolved
  const onChainOP = onChainOPBalance !== undefined ? Number(onChainOPBalance / OP_DECIMALS) : null;
  // Only gate when balance is confirmed below threshold — never block while loading
  const insufficientBalance = onChainOP !== null && onChainOP < TACKLE_BOX_COST;

  const JOURNAL_LIST = FISH_LIST.filter(f => f.rarity !== 'NFT');
  const oceanTreasuresFound = discoveredFishIds.filter(id => OCEAN_TREASURES.some(f => f.id === id)).length;
  const journalFound = discoveredFishIds.filter(id => JOURNAL_LIST.some(f => f.id === id)).length + oceanTreasuresFound;
  const journalTotal = JOURNAL_LIST.length + OCEAN_TREASURES.length;
  const journalPct = (journalFound / journalTotal) * 100;

  // Net: available-to-trade items first
  const sortedInventory = [...inventory].sort((a, b) => {
    if (a.redeemed === b.redeemed) return 0;
    return a.redeemed ? 1 : -1;
  });

  // Market: 24h rolling countdown from purchase time
  const [tackleCountdown, setTackleCountdown] = useState('');
  useEffect(() => {
    if (!state?.tackleBoxPurchasedAt) return;
    const resetAt = new Date(state.tackleBoxPurchasedAt).getTime() + 24 * 60 * 60 * 1000;
    const tick = () => {
      const ms = resetAt - Date.now();
      if (ms <= 0) { setTackleCountdown(''); return; }
      const s = Math.floor(ms / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      setTackleCountdown(`${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state?.tackleBoxPurchasedAt]);

  if (!isConnected) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: FRAME_H }}>
        <div className="text-center p-12 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl max-w-sm mx-auto">
          <Anchor size={48} className="mx-auto mb-6 text-dream-cyan opacity-50" />
          <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">Wallet Required</h2>
          <p className="text-white/50 font-mono text-sm leading-relaxed mb-8">
            Connect your wallet to explore the deep ocean, catch rare species, and earn $OP rewards.
          </p>
          <div className="flex justify-center">
            <div className="px-6 py-3 bg-dream-cyan/10 border border-dream-cyan/20 rounded-xl">
              <span className="text-dream-cyan font-mono font-bold text-xs uppercase tracking-widest">Connection Required</span>
            </div>
          </div>
          </div>
          </div>
          );
          }

          // Add Loading State
          if (loading && !state) {
          return (
          <div className="w-full flex items-center justify-center" style={{ height: FRAME_H }}>
          <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 rounded-full border-4 border-white/5 border-t-dream-cyan/80 animate-spin" />
          <span className="font-mono text-dream-cyan/60 uppercase tracking-[0.2em] text-xs">Verifying Access...</span>
          </div>
          </div>
          );
          }

          // Add NFT Gating State
          if (state && state.isNFTOwner === false) {
          return (
          <div className="w-full flex items-center justify-center" style={{ height: FRAME_H }}>
          <div className="text-center p-10 bg-black/40 border border-white/5 rounded-3xl backdrop-blur-2xl max-w-sm mx-auto shadow-2xl">
          <XCircle size={48} className="mx-auto mb-6 text-dream-purple opacity-80" />
          <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">Access Denied</h2>
          <p className="text-white/50 font-mono text-sm leading-relaxed mb-8">
            This area of the ocean is restricted. You must own a WhaleTown NFT to fish and earn rewards.
          </p>
          <div className="flex justify-center">
            <Link 
              to="/trade"
              className="px-6 py-3 bg-dream-purple/10 hover:bg-dream-purple/20 border border-dream-purple/30 rounded-xl transition-colors inline-block"
            >
              <span className="text-dream-purple font-mono font-bold text-xs uppercase tracking-widest">Visit the Exchange</span>
            </Link>
          </div>
          </div>
          </div>
          );
          }

          return (
          <div className="w-full flex justify-center items-start">
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
              label="Unclaimed $OP"
              aria={`${coins} unclaimed $OP`}
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
          <AnimatePresence>
            {tab === 'ocean' && (
              <motion.div
                key="ocean"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0"
              >
                <GameScene cast={cast} attempts={attempts} />
              </motion.div>
            )}

            {tab === 'net' && (
              <motion.div
                key="net"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto"
                style={{ padding: 'clamp(1.1rem, 2vw, 1.75rem)' }}
              >
                <SectionHead
                  eyebrow="Your net"
                  title={inventory.length === 0 ? 'Empty' : `${inventory.length} caught`}
                  sub="Sell non-NFT catches for $OP. NFTs are claimable on Profile."
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
                    {sortedInventory.map((item) => {
                      const fish = item.fish;
                      const t = tint(fish.rarity);
                      const isNft = fish.rarity === 'NFT';
                      const isRedeemed = item.redeemed;

                      const isSelling = sellingId === item.gameEventId;

                      return (
                        <div
                          key={item.gameEventId}
                          className={`relative flex flex-col items-center text-center border ${t.border} bg-white/[0.025] ${t.glow} transition-colors hover:bg-white/[0.045] ${isRedeemed ? 'opacity-40 grayscale' : ''}`}
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
                            {isNft ? `${fish.nftTier} NFT` : fish.rarity}
                          </span>
                          <span
                            style={{
                              fontSize: 'clamp(2.25rem, 3.6vw, 3rem)',
                              marginTop: 'clamp(0.65rem, 1.3vh, 1rem)',
                            }}
                          >
                            {fish.icon}
                          </span>
                          <div
                            className="font-bold text-dream-white"
                            style={{
                              fontSize: 'clamp(12px, 0.95vw, 14px)',
                              marginTop: 'clamp(0.5rem, 1vh, 0.75rem)',
                            }}
                          >
                            {fish.name}
                          </div>
                          {!isNft && (
                            <div
                              className="flex items-center gap-1.5 text-white/50 font-mono"
                              style={{
                                fontSize: 'clamp(10px, 0.8vw, 12px)',
                                marginTop: 'clamp(0.2rem, 0.4vh, 0.3rem)',
                              }}
                            >
                              <Zap size={10} className="text-sun" fill="currentColor" />
                              <span className="text-sun/90">{fish.value} $OP</span>
                            </div>
                          )}
                          {isNft ? (
                            <button
                              disabled
                              className="w-full bg-dream-purple/15 border border-dream-purple/40 text-dream-purple font-mono font-bold transition-colors opacity-50"
                              style={{
                                fontSize: 'clamp(10px, 0.8vw, 12px)',
                                padding: 'clamp(0.5rem, 1vh, 0.7rem)',
                                borderRadius: 'clamp(0.5rem, 0.7vw, 0.65rem)',
                                marginTop: 'clamp(0.85rem, 1.7vh, 1.15rem)',
                                letterSpacing: '0.08em',
                              }}
                            >
                              Claim on Profile
                            </button>
                          ) : (
                            <button
                              onClick={() => !isRedeemed && !isSelling && sell(item.gameEventId)}
                              disabled={isRedeemed || isSelling}
                              className={`w-full font-mono font-bold transition-colors ${isRedeemed || isSelling ? 'bg-white/5 text-white/20 border border-white/5' : 'bg-white/[0.04] hover:bg-dream-cyan/15 border border-white/10 hover:border-dream-cyan/40 text-white/80 hover:text-dream-cyan'}`}
                              style={{
                                fontSize: 'clamp(10px, 0.8vw, 12px)',
                                padding: 'clamp(0.5rem, 1vh, 0.7rem)',
                                borderRadius: 'clamp(0.5rem, 0.7vw, 0.65rem)',
                                marginTop: 'clamp(0.85rem, 1.7vh, 1.15rem)',
                                letterSpacing: '0.08em',
                              }}
                            >
                              {isRedeemed ? 'Traded' : isSelling ? 'Trading...' : 'Trade'}
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto"
                style={{ padding: 'clamp(1.1rem, 2vw, 1.75rem)' }}
              >
                <SectionHead
                  eyebrow="Market"
                  title="Supplies & bait"
                  sub="Restock before your next cast"
                />
                <div
                  className="flex items-center gap-1.5 font-mono text-white/50"
                  style={{ fontSize: 'clamp(11px, 0.85vw, 13px)', marginBottom: 'clamp(0.65rem, 1.2vh, 0.9rem)' }}
                >
                  <Coins size={11} className="text-sun" fill="currentColor" />
                  <span>Wallet: <span className="text-sun/80 font-bold">{onChainOP !== null ? `${onChainOP.toLocaleString()} $OP` : '...'}</span></span>
                </div>
                <div className="flex flex-col" style={{ gap: 'clamp(0.6rem, 1.2vh, 0.85rem)' }}>
                  <MarketRow
                    icon="📦"
                    name="Tackle Box"
                    desc={`+10 casts today · one per day · on-chain purchase`}
                    price={TACKLE_BOX_COST}
                    disabled={state?.tackleBoxPurchased || isPurchasing || insufficientBalance}
                    disabledLabel={
                      state?.tackleBoxPurchased
                        ? tackleCountdown ? tackleCountdown : 'Available tomorrow'
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto"
                style={{ padding: 'clamp(1.1rem, 2vw, 1.75rem)' }}
              >
                <SectionHead
                  eyebrow="Journal"
                  title={`${journalFound} of ${journalTotal} collected`}
                  sub="Go fish and be the first to fill your journal"
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
                  {JOURNAL_LIST.map(f => {
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

                {/* Ocean Treasures section */}
                <div style={{ marginTop: 'clamp(1.25rem, 2.5vh, 2rem)' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 'clamp(0.6rem, 1.2vh, 0.9rem)' }}>
                    <span style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.7rem)' }} className="font-mono uppercase tracking-[0.18em] text-amber-400/70">
                      Ocean Treasures
                    </span>
                    <div className="flex-1 h-px bg-amber-400/15" />
                    <span style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.7rem)' }} className="font-mono text-amber-400/50">
                      {oceanTreasuresFound}/{OCEAN_TREASURES.length}
                    </span>
                  </div>
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(3.5rem, 5.5vw, 4.5rem), 1fr))',
                      gap: 'clamp(0.45rem, 0.9vw, 0.7rem)',
                    }}
                  >
                    {OCEAN_TREASURES.map(f => {
                      const found = discoveredFishIds.includes(f.id);
                      const t = tint(f.rarity);
                      return (
                        <div
                          key={f.id}
                          aria-label={found ? `${f.name}, ${f.rarity}` : 'Undiscovered treasure'}
                          className={`aspect-square flex flex-col items-center justify-center border transition-colors ${
                            found
                              ? `${t.border} bg-amber-400/[0.04] hover:bg-amber-400/[0.08]`
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Dev-only grant button — hidden when ENVIRONMENT=production */}
      {(import.meta as any).env?.DEV && process.env.IS_PRODUCTION !== 'true' && (
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
          <span
            className="font-mono font-bold text-sun"
            style={{ fontSize: 'clamp(13px, 1vw, 15px)' }}
          >
            {price} $OP
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
          {disabled ? (disabledLabel ?? 'Buy') : 'Buy'}
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
