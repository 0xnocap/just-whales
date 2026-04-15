import React, { useState, useCallback, useEffect } from 'react';
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
import type { ActivityFilterKey } from '../types';
import { ACTIVITY_FILTERS } from '../constants/activity';
import { SORT_OPTIONS, TRADE_BATCH } from '../constants/trade';
import { useCollectionData } from '../hooks/useCollectionData';
import SkeletonCard from '../components/SkeletonCard';
import NFTCard from '../components/NFTCard';
import SweepBar from '../components/SweepBar';
import ActivityFeed from '../components/ActivityFeed';
import ActivitySidebar from '../components/ActivitySidebar';
import TradeScrollSentinel from '../components/TradeScrollSentinel';

interface TradePageProps {
  onSelectToken: (t: any) => void;
  onSweepModeChange?: (active: boolean) => void;
  showActivity: boolean;
  setShowActivity: (show: boolean) => void;
}

const TradePage: React.FC<TradePageProps> = ({ 
  onSelectToken, 
  onSweepModeChange,
  showActivity,
  setShowActivity
}) => {
  const { isConnected, address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilterKey>('all');
  const [filter, setFilter] = useState<'all' | 'listed' | 'unlisted'>('all');
  const [sort, setSort] = useState<'price_asc' | 'price_desc' | 'id_asc' | 'id_desc' | 'rarity_asc' | 'rarity_desc'>('price_asc');
  
  const {
    tokens, listings, ownerMap, collectionStats, totalMinted, loading, fetchData,
    loadingMore, setLoadingMore, loadingMoreRef,
    nextIdDesc, nextIdAsc, loadBatchDesc, loadBatchAsc,
    collectionData, traitFilters, toggleTraitFilter, clearAllFilters, activeFilterCount,
    filteredTokens, loadingFiltered, filteredMatchIds, loadMoreFiltered,
    handleBuySuccess
  } = useCollectionData();

  // --- Sweep state ---
  const [sweepMode, setSweepMode] = useState(false);
  const [sweepSelected, setSweepSelected] = useState<any[]>([]);
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const [sweepError, setSweepError] = useState('');
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

  const [openTraitSections, setOpenTraitSections] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileFilterSheet, setShowMobileFilterSheet] = useState(false);
  const [activeTradeTab, setActiveTradeTab] = useState<'items' | 'activity'>('items');

  useEffect(() => {
    if (sort === 'id_asc' && nextIdAsc === 0 && totalMinted > 0 && !loadingMore && activeFilterCount === 0) {
      setLoadingMore(true);
      loadBatchAsc(0, totalMinted).then(() => setLoadingMore(false));
    }
  }, [sort, nextIdAsc, totalMinted, loadingMore, activeFilterCount, loadBatchAsc, setLoadingMore]);

  // Choose data source: filtered tokens when filters active, else normal tokens
  const isFiltered = activeFilterCount > 0;

  // Merge listings with gallery (for unfiltered view)
  const unifiedTokens = [
    ...listings.map(l => ({ ...l.metadata, id: Number(l.tokenId), isListing: true, listingData: l })),
    ...tokens.filter(t => !listings.some(l => Number(l.tokenId) === t.id))
  ];

  // Base display tokens
  let displayTokens = isFiltered ? [...filteredTokens] : [...unifiedTokens];

  // Enrich filtered tokens with listing data BEFORE filtering on status
  if (isFiltered) {
    displayTokens = displayTokens.map(t => {
      const listing = listings.find(l => Number(l.tokenId) === t.id);
      if (listing) return { ...t, isListing: true, listingData: listing };
      return t;
    });
  }

  // Apply status filter
  if (filter === 'listed') displayTokens = displayTokens.filter(t => t.isListing);
  if (filter === 'unlisted') displayTokens = displayTokens.filter(t => !t.isListing);
  if (searchQuery) displayTokens = displayTokens.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(t.id).includes(searchQuery));

  // Sort — listings always float above unlisted; within each group apply the chosen sort
  displayTokens = [...displayTokens].sort((a, b) => {
    const aListed = !!a.isListing;
    const bListed = !!b.isListing;

    // Always: listed above unlisted
    if (aListed && !bListed) return -1;
    if (!aListed && bListed) return 1;

    // Both listed: sort by price
    if (aListed && bListed) {
      const aPrice = Number(a.listingData.price);
      const bPrice = Number(b.listingData.price);
      if (sort === 'price_desc') return bPrice - aPrice;
      return aPrice - bPrice; // price_asc is default for listings
    }

    // Both unlisted: apply chosen secondary sort
    if (sort === 'rarity_asc' && collectionData) {
      const aRank = collectionData.rarityRanks[String(a.id)] || 9999;
      const bRank = collectionData.rarityRanks[String(b.id)] || 9999;
      return aRank - bRank;
    }
    if (sort === 'rarity_desc' && collectionData) {
      const aRank = collectionData.rarityRanks[String(a.id)] || 0;
      const bRank = collectionData.rarityRanks[String(b.id)] || 0;
      return bRank - aRank;
    }
    if (sort === 'id_desc') return b.id - a.id;
    return a.id - b.id; // default: id asc
  });

  // Has more to load?
  const hasMoreFiltered = isFiltered && (filteredTokens.length < filteredMatchIds.length);
  const hasMoreUnfiltered = !isFiltered && (nextIdDesc >= 0 || nextIdAsc < totalMinted);

  // Floor price from listings
  const floorPrice = listings.length > 0
    ? Math.min(...listings.map(l => Number(formatUnits(l.price, 6))))
    : 0;

  return (
    <div className="w-full" style={{ maxWidth: '100%' }}>
      {/* Collection Banner */}
      <div className="relative rounded-2xl overflow-hidden mb-2" style={{ minHeight: 'clamp(130px, 20vw, 240px)' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c4a6e] via-[#083344] to-[#1e1b4b]" />
        <div className="absolute top-4 right-8 text-4xl opacity-[0.07]">🐋</div>
        <div className="absolute bottom-16 right-24 text-2xl opacity-[0.05] hidden md:block">🦈</div>
        <div className="absolute top-6 right-44 text-xl opacity-[0.05] hidden md:block">🦭</div>

        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-6 pb-4 md:pb-6">
          <div className="hidden md:flex items-end justify-between gap-6">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/10 flex-shrink-0">
                <img src="/collections/whale-town/collection_image.png" alt="Whale Town" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-black text-white tracking-tight">Whale Town</h1>
                  <svg viewBox="0 0 22 22" className="w-5 h-5 flex-shrink-0 mt-1" fill="none"><path d="M11 0l2.8 3.2L17.5 2l.8 4.2L22 7.8l-2 3.6 2 3.6-3.7 1.6-.8 4.2-3.7-1.2L11 22l-2.8-2.2-3.7 1.2-.8-4.2L0 15.2l2-3.6L0 8l3.7-1.8.8-4.2 3.7 1.2L11 0z" fill="#f59e0b"/><path d="M7 11l2.5 2.5L15 8.5" stroke="#0a0a0c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                </div>
                <p className="text-white/50 text-[13px] font-mono max-w-md">Sealions, Sharks, and Whales, oh my! The first onchain collection on Tempo.</p>
              </div>
            </div>
            <div className="flex items-end gap-5 pb-1">
              {[
                { label: 'Floor',   value: floorPrice > 0 ? `$${floorPrice.toFixed(2)}` : (loading ? null : '—') },
                { label: 'Listed',  value: loading ? null : listings.length.toString() },
                { label: 'Holders', value: collectionStats ? collectionStats.holders?.toLocaleString() : null },
                { label: 'Volume',  value: collectionStats ? `$${collectionStats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : null },
              ].map(stat => (
                <div key={stat.label} className="text-right">
                  <div className="text-[10px] font-mono text-white/40 uppercase tracking-[0.1em]">{stat.label}</div>
                  {stat.value != null
                    ? <div className="text-[15px] font-bold text-white leading-none mt-0.5">{stat.value}</div>
                    : <div className="w-12 h-4 bg-white/10 rounded animate-pulse mt-0.5" />
                  }
                </div>
              ))}
            </div>
          </div>

          {activeTradeTab === 'items' && (
            <div className="md:hidden flex items-end justify-between gap-3">
              <div className="flex items-end gap-2.5 min-w-0">
                <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                  <img src="/collections/whale-town/collection_image.png" alt="Whale Town" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                </div>
                <div className="min-w-0 pb-0.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-black text-[15px] text-white leading-none">Whale Town</span>
                    <svg viewBox="0 0 22 22" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none"><path d="M11 0l2.8 3.2L17.5 2l.8 4.2L22 7.8l-2 3.6 2 3.6-3.7 1.6-.8 4.2-3.7-1.2L11 22l-2.8-2.2-3.7 1.2-.8-4.2L0 15.2l2-3.6L0 8l3.7-1.8.8-4.2 3.7 1.2L11 0z" fill="#f59e0b"/><path d="M7 11l2.5 2.5L15 8.5" stroke="#0a0a0c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                  </div>
                  <p className="text-[9px] font-mono text-white/40 truncate">Sealions, Sharks, and Whales, oh my! The first onchain collection on Tempo.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-shrink-0 pb-0.5">
                {[
                  { label: 'Floor',   value: floorPrice > 0 ? `$${floorPrice.toFixed(2)}` : (loading ? null : '—') },
                  { label: 'Listed',  value: loading ? null : listings.length.toString() },
                  { label: 'Volume',  value: collectionStats ? `$${collectionStats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : null },
                  { label: 'Holders', value: collectionStats ? collectionStats.holders?.toLocaleString() : null },
                ].map(stat => (
                  <div key={stat.label} className="text-right">
                    <div className="text-[7px] font-mono uppercase tracking-widest text-white/30">{stat.label}</div>
                    {stat.value != null
                      ? <div className="text-[13px] font-black text-white leading-none mt-0.5">{stat.value}</div>
                      : <div className="w-8 h-3.5 bg-white/10 rounded animate-pulse mt-0.5 ml-auto" />
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTradeTab === 'activity' && (
            <div className="md:hidden flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                    <img src="/collections/whale-town/collection_image.png" alt="Whale Town" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-[13px] text-white leading-none">Whale Town</span>
                    <svg viewBox="0 0 22 22" className="w-3 h-3 flex-shrink-0" fill="none"><path d="M11 0l2.8 3.2L17.5 2l.8 4.2L22 7.8l-2 3.6 2 3.6-3.7 1.6-.8 4.2-3.7-1.2L11 22l-2.8-2.2-3.7 1.2-.8-4.2L0 15.2l2-3.6L0 8l3.7-1.8.8-4.2 3.7 1.2L11 0z" fill="#f59e0b"/><path d="M7 11l2.5 2.5L15 8.5" stroke="#0a0a0c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-dream-cyan animate-pulse" />
                  <span className="text-[9px] font-mono font-bold text-dream-cyan uppercase tracking-wider">Live</span>
                </div>
              </div>
              <div className="flex border-t border-white/[0.06] pt-2">
                {[
                  { label: 'Floor',   value: floorPrice > 0 ? `$${floorPrice.toFixed(2)}` : (loading ? null : '—') },
                  { label: 'Listed',  value: loading ? null : listings.length.toString() },
                  { label: 'Volume',  value: collectionStats ? `$${collectionStats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : null },
                  { label: 'Holders', value: collectionStats ? collectionStats.holders?.toLocaleString() : null },
                ].map((stat, i, arr) => (
                  <div key={stat.label} className={`flex-1 text-center ${i < arr.length - 1 ? 'border-r border-white/[0.06]' : ''}`}>
                    <div className="text-[7px] font-mono uppercase tracking-widest text-white/30">{stat.label}</div>
                    {stat.value != null
                      ? <div className="text-[12px] font-black text-white leading-none mt-0.5">{stat.value}</div>
                      : <div className="w-8 h-3 bg-white/10 rounded animate-pulse mt-0.5 mx-auto" />
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Toolbar */}
      <div className="sticky top-[52px] z-50 py-0 -mx-4 px-4 mb-2 flex flex-col md:flex-row items-center gap-2 md:gap-4">
        <div className="hidden md:flex items-center gap-4 w-full">
          <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 shrink-0">
            {(['items', 'activity'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTradeTab(tab)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-all cursor-pointer ${
                  activeTradeTab === tab
                    ? 'bg-dream-cyan/15 text-dream-cyan'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                {tab === 'items' ? <Grid3X3 className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                {tab === 'items' ? 'Items' : 'Activity'}
              </button>
            ))}
          </div>

          <div className="h-4 w-[1px] bg-white/10 shrink-0" />

          {activeTradeTab === 'items' ? (
            <>
              <div className="hidden lg:flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5 shrink-0">
                {(['all', 'listed', 'unlisted'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer ${
                      filter === f
                        ? 'bg-dream-cyan/15 text-dream-cyan'
                        : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border shrink-0 ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30'
                    : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:border-white/20'
                }`}
              >
                <Filter className="w-3 h-3" />
                <span className="hidden sm:inline">Filters</span>{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>

              <select
                value={sort}
                onChange={e => setSort(e.target.value as any)}
                className="hidden xl:block bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 font-mono text-[10px] text-white/60 outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors shrink-0"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <div className="relative flex-1 min-w-[120px]">
                <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-3.5 h-3.5 text-white/20" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg font-mono text-[11px] text-white placeholder:text-white/20 focus:border-dream-cyan/30 outline-none transition-all"
                />
              </div>

              <button
                onClick={() => setShowActivity(!showActivity)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border shrink-0 ${
                  showActivity
                    ? 'bg-dream-cyan/20 border-dream-cyan/40 text-dream-cyan'
                    : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:border-white/20'
                }`}
              >
                <Activity className="w-3 h-3" />
                <span className="hidden sm:inline">Live</span>
              </button>

              {listings.length > 0 && (
                <button
                  onClick={() => {
                    const next = !sweepMode;
                    setSweepMode(next);
                    onSweepModeChange?.(next);
                    if (!next) { setSweepSelected([]); setSweepResult(null); setSweepError(''); }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border shrink-0 ${
                    sweepMode
                      ? 'bg-dream-cyan text-[#0a0a0c] border-dream-cyan shadow-[0_0_20px_rgba(34,211,238,0.4)]'
                      : 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30 shadow-[0_0_10px_rgba(34,211,238,0.1)] hover:bg-dream-cyan/25 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span className="hidden sm:inline">Sweep</span>{sweepMode && sweepSelected.length > 0 ? ` (${sweepSelected.length})` : ''}
                </button>
              )}
            </>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {ACTIVITY_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setActivityFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border whitespace-nowrap ${
                    activityFilter === f.key
                      ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30'
                      : 'bg-white/[0.03] text-white/30 border-white/[0.06] hover:text-white/60 hover:border-white/15'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex md:hidden flex-col w-full gap-2">
          <div className="flex w-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            {(['items', 'activity'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTradeTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-all cursor-pointer ${
                  activeTradeTab === tab
                    ? 'bg-dream-cyan/15 text-dream-cyan'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                {tab === 'items' ? <Grid3X3 className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                {tab === 'items' ? 'Items' : 'Activity'}
              </button>
            ))}
          </div>

          {activeTradeTab === 'items' ? (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-3.5 h-3.5 text-white/20" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg font-mono text-[11px] text-white placeholder:text-white/20 focus:border-dream-cyan/30 outline-none transition-all"
                />
              </div>

              <button
                onClick={() => setShowMobileFilterSheet(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border shrink-0 ${
                  activeFilterCount > 0
                    ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30'
                    : 'bg-white/[0.03] text-white/40 border-white/[0.06]'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                {activeFilterCount > 0 ? `(${activeFilterCount})` : 'Filter'}
              </button>

              {listings.length > 0 && (
                <button
                  onClick={() => {
                    const next = !sweepMode;
                    setSweepMode(next);
                    onSweepModeChange?.(next);
                    if (!next) { setSweepSelected([]); setSweepResult(null); setSweepError(''); }
                  }}
                  className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all cursor-pointer border shrink-0 ${
                    sweepMode
                      ? 'bg-dream-cyan text-[#0a0a0c] border-dream-cyan shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                      : 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-1.5">
              {ACTIVITY_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setActivityFilter(f.key)}
                  className={`flex-1 py-2 rounded-lg font-mono text-[9px] font-bold uppercase tracking-[0.15em] transition-all cursor-pointer border ${
                    activityFilter === f.key
                      ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30'
                      : 'bg-white/[0.03] text-white/30 border-white/[0.06]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeTradeTab === 'activity' ? (
        <ActivityFeed externalFilter={activityFilter} refreshKey={activityRefreshKey} />
      ) : (
      <>
      {sweepMode && listings.length > 0 && (
        <div className="flex gap-1 mb-2 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5 w-fit">
          {[3, 5, 10].map(n => (
            <button
              key={n}
              onClick={() => {
                const floor = [...listings]
                  .sort((a, b) => Number(a.price) - Number(b.price))
                  .slice(0, n);
                setSweepSelected(floor);
                setSweepResult(null);
              }}
              className="px-3 py-1.5 rounded-md font-mono text-[10px] font-bold text-white/40 hover:text-dream-cyan hover:bg-dream-cyan/10 transition-all cursor-pointer tracking-[0.1em]"
            >
              Floor {n}
            </button>
          ))}
        </div>
      )}

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(Object.entries(traitFilters) as [string, string[]][]).map(([traitType, values]) =>
            values.map(value => (
              <button
                key={`${traitType}-${value}`}
                onClick={() => toggleTraitFilter(traitType, value)}
                className="flex items-center gap-1 px-2 py-1 bg-dream-cyan/10 border border-dream-cyan/20 rounded-lg text-dream-cyan font-mono text-[10px] hover:bg-dream-cyan/20 transition-colors cursor-pointer"
              >
                <span className="text-dream-cyan/50">{traitType}:</span> {value}
                <X className="w-2.5 h-2.5 ml-0.5" />
              </button>
            ))
          )}
          <button
            onClick={clearAllFilters}
            className="px-2 py-1 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/30 font-mono text-[10px] hover:text-white/60 transition-colors cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="flex gap-4">
        {showFilters && collectionData && (
          <div className="w-56 flex-shrink-0 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 self-start sticky top-28 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.15em] font-bold">Traits</span>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} className="text-[9px] font-mono text-dream-cyan/60 hover:text-dream-cyan cursor-pointer">Clear</button>
              )}
            </div>
            {Object.entries(collectionData.traitsIndex)
              .filter(([traitType]) => traitType !== 'Trait Count')
              .map(([traitType, values]) => {
                const isOpen = openTraitSections[traitType] || false;
                const selectedValues = traitFilters[traitType] || [];
                const sortedValues = Object.entries(values).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={traitType} className="border-b border-white/[0.04] last:border-b-0">
                    <button
                      onClick={() => setOpenTraitSections(prev => ({ ...prev, [traitType]: !isOpen }))}
                      className="w-full flex items-center justify-between py-2.5 text-left cursor-pointer group"
                    >
                      <span className="text-[11px] font-mono text-white/60 group-hover:text-white/80 transition-colors">
                        {traitType}
                        {selectedValues.length > 0 && (
                          <span className="ml-1 text-dream-cyan">({selectedValues.length})</span>
                        )}
                      </span>
                      {isOpen ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
                    </button>
                    {isOpen && (
                      <div className="pb-2.5 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                        {sortedValues.map(([value, count]) => {
                          const isSelected = selectedValues.includes(value);
                          return (
                            <button
                              key={value}
                              onClick={() => toggleTraitFilter(traitType, value)}
                              className={`flex items-center justify-between px-2 py-1.5 rounded-md text-left cursor-pointer transition-colors font-mono text-[10px] ${
                                isSelected
                                  ? 'bg-dream-cyan/15 text-dream-cyan'
                                  : 'text-white/40 hover:bg-white/[0.04] hover:text-white/60'
                              }`}
                            >
                              <span className="truncate">{value === 'None' ? 'None' : value}</span>
                              <span className="text-[9px] text-white/20 ml-1 flex-shrink-0">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {(loading || (unifiedTokens.length === 0 && !isFiltered && totalMinted > 0)) ? (
            <div className={`grid gap-2.5 ${showFilters ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
              {Array.from({ length: TRADE_BATCH }).map((_, i) => <SkeletonCard key={`init-skeleton-${i}`} />)}
            </div>
          ) : (isFiltered && filteredTokens.length === 0) ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1">
                <Loader2 className="animate-spin text-dream-cyan/40 w-4 h-4" />
                <span className="font-mono text-white/30 text-[10px] tracking-wider">
                  Loading {filteredMatchIds.length} matching tokens...
                </span>
              </div>
              <div className={`grid gap-2.5 ${showFilters ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
                {Array.from({ length: Math.min(TRADE_BATCH, filteredMatchIds.length) }).map((_, i) => <SkeletonCard key={`filter-skeleton-${i}`} />)}
              </div>
            </div>
          ) : displayTokens.length === 0 && !loading && !loadingFiltered ? (
            <div className="text-center py-20 border border-dashed border-white/[0.06] rounded-2xl bg-white/[0.02]">
              <p className="font-mono text-white/20 uppercase tracking-widest text-[11px]">
                {activeFilterCount > 0 ? `No tokens match your filters.` : 'No tokens found.'}
              </p>
            </div>
           ) : (
            <div className={`grid gap-2.5 ${showFilters ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
              {displayTokens.map((token) => {
                const isListed = !!token.isListing;
                const listing = token.listingData;
                const tokenOwner = ownerMap[token.id];
                const isOwner = isConnected && address && tokenOwner?.toLowerCase() === address.toLowerCase();
                const isSeller = isListed && isConnected && address && listing.seller.toLowerCase() === address.toLowerCase();
                const rarityRank = collectionData?.rarityRanks?.[String(token.id)];
                const isSweepSelected = sweepMode && isListed && sweepSelected.some(s => String(s.id) === String(listing?.id));

                const handleSweepToggle = () => {
                  setSweepResult(null);
                  if (isSweepSelected) {
                    setSweepSelected(prev => prev.filter(s => String(s.id) !== String(listing.id)));
                  } else {
                    setSweepSelected(prev => [...prev, listing]);
                  }
                };

                return (
                  <div
                    key={isListed ? `listing-${listing.id}` : `gallery-${token.id}`}
                    className={`relative ${sweepMode && isListed && !isSeller ? 'cursor-pointer' : ''}`}
                    onClick={sweepMode && isListed && !isSeller ? handleSweepToggle : undefined}
                  >
                    {sweepMode && isListed && !isSeller && (
                      <div
                        className={`absolute top-2 left-2 z-30 w-5 h-5 rounded-md border-2 flex items-center justify-center pointer-events-none ${
                          isSweepSelected
                            ? 'bg-dream-cyan border-dream-cyan shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                            : 'bg-black/60 border-white/30 backdrop-blur-sm'
                        }`}
                      >
                        {isSweepSelected && <Check className="w-3 h-3 text-[#0a0a0c]" strokeWidth={3} />}
                      </div>
                    )}
                    {sweepMode && !isListed && (
                      <div className="absolute inset-0 z-20 rounded-xl bg-black/50 pointer-events-none" />
                    )}
                    <NFTCard
                      token={token}
                      isListed={isListed}
                      listing={listing}
                      isOwner={isOwner}
                      isSeller={isSeller}
                      tokenOwner={tokenOwner}
                      rarityRank={rarityRank}
                      onSelect={sweepMode ? () => {} : onSelectToken}
                      fetchData={fetchData}
                      onBuySuccess={isListed ? () => handleBuySuccess(listing.id) : undefined}
                    />
                  </div>
                );
              })}
              {(loadingMore || loadingFiltered || hasMoreFiltered || hasMoreUnfiltered) && Array.from({ length: TRADE_BATCH }).map((_, i) => (
                <SkeletonCard key={`skeleton-more-${i}`} />
              ))}
            </div>
          )}

          {(hasMoreFiltered || hasMoreUnfiltered) && (
            <TradeScrollSentinel
              loadingMore={loadingMore}
              loadingFiltered={loadingFiltered}
              activeFilterCount={activeFilterCount}
              sort={sort}
              nextIdAsc={nextIdAsc}
              nextIdDesc={nextIdDesc}
              totalMinted={totalMinted}
              loadBatchAsc={loadBatchAsc}
              loadBatchDesc={loadBatchDesc}
              loadMoreFiltered={loadMoreFiltered}
              setLoadingMore={setLoadingMore}
              loadingMoreRef={loadingMoreRef}
            />
          )}

          {isFiltered && filteredMatchIds.length > 0 && displayTokens.length > 0 && (
            <div className="text-center py-3">
              <span className="font-mono text-white/20 text-[10px] tracking-wider">
                Showing {displayTokens.length} of {filteredMatchIds.length} matching tokens
              </span>
            </div>
          )}
        </div>
        
        <ActivitySidebar 
          isOpen={showActivity} 
          onClose={() => setShowActivity(false)} 
        />
      </div>

      <AnimatePresence>
        {sweepMode && (
          <SweepBar
            selectedListings={sweepSelected}
            onRemove={(id) => setSweepSelected(prev => prev.filter(s => String(s.id) !== String(id)))}
            onClearAll={() => { setSweepSelected([]); setSweepResult(null); setSweepMode(false); onSweepModeChange?.(false); }}
            isSweeping={isSweeping}
            sweepResult={sweepResult}
            onSweep={async () => {
              if (!isConnected || sweepSelected.length === 0) return;
              setIsSweeping(true);
              setSweepError('');
              setSweepResult(null);
              try {
                const totalCost = sweepSelected.reduce((sum: bigint, l: any) => sum + BigInt(l.price), 0n);
                const allowance = await readPathUSDAllowance(address!, marketplaceAddress);
                if (allowance < totalCost) {
                  const approveHash = await writeContractAsync({
                    address: pathUSDAddress,
                    abi: pathUSDAbi,
                    functionName: 'approve',
                    args: [marketplaceAddress, totalCost],
                  } as any);
                  await waitForTransaction(approveHash);
                }
                const listingIds = sweepSelected.map((l: any) => BigInt(l.id));
                const hash = await writeContractAsync({
                  address: marketplaceAddress,
                  abi: marketplaceAbi,
                  functionName: 'batchBuy',
                  args: [listingIds],
                } as any);

                // Optimistic DB updates for every listing in the batch
                sweepSelected.forEach((l: any) => {
                  api.saleListing(l.id.toString(), address!, hash).catch(() => {});
                });

                await waitForTransaction(hash);
                // Refresh listings and count which ones actually disappeared (were bought)
                await fetchData();
                setSweepResult({ succeeded: sweepSelected.length, failed: 0 });
                setSweepSelected([]);
                setActivityRefreshKey(k => k + 1);
              } catch (err: any) {
                setSweepError(err.shortMessage || err.message || 'Sweep failed');
                console.error(err);
              } finally {
                setIsSweeping(false);
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMobileFilterSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileFilterSheet(false)}
              className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-[170] bg-[#0a0a0c] border-t border-white/10 rounded-t-3xl max-h-[85vh] flex flex-col md:hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-dream-cyan" />
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-widest">Filters</h2>
                </div>
                <button
                  onClick={() => setShowMobileFilterSheet(false)}
                  className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-white/40 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar pb-32">
                <div>
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em] font-bold block mb-3">Status</span>
                  <div className="flex gap-2">
                    {(['all', 'listed', 'unlisted'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`flex-1 py-2.5 rounded-xl font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-all border ${
                          filter === f
                            ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30'
                            : 'bg-white/[0.03] text-white/40 border-white/[0.06]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em] font-bold block mb-3">Sort By</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Price ↑', value: 'price_asc' },
                      { label: 'Price ↓', value: 'price_desc' },
                      { label: 'Rarity', value: 'rarity_asc' },
                      { label: 'Token ID', value: 'id_asc' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setSort(opt.value as any)}
                        className={`py-3 rounded-xl font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-all border ${
                          sort === opt.value
                            ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30'
                            : 'bg-white/[0.03] text-white/40 border-white/[0.06]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {collectionData && (
                  <div>
                    <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em] font-bold block mb-3">Traits</span>
                    <div className="space-y-2">
                      {Object.entries(collectionData.traitsIndex)
                        .filter(([traitType]) => traitType !== 'Trait Count')
                        .map(([traitType, values]) => {
                          const isOpen = openTraitSections[traitType] || false;
                          const selectedValues = traitFilters[traitType] || [];
                          const sortedValues = Object.entries(values).sort((a, b) => b[1] - a[1]);
                          return (
                            <div key={traitType} className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
                              <button
                                onClick={() => setOpenTraitSections(prev => ({ ...prev, [traitType]: !isOpen }))}
                                className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
                              >
                                <span className="text-xs font-mono text-white/70">
                                  {traitType}
                                  {selectedValues.length > 0 && (
                                    <span className="ml-2 text-dream-cyan">({selectedValues.length})</span>
                                  )}
                                </span>
                                {isOpen ? <ChevronUp className="w-4 h-4 text-white/20" /> : <ChevronDown className="w-4 h-4 text-white/20" />}
                              </button>
                              {isOpen && (
                                <div className="p-4 pt-0 flex flex-wrap gap-1.5">
                                  {sortedValues.map(([value, count]) => {
                                    const isSelected = selectedValues.includes(value);
                                    return (
                                      <button
                                        key={value}
                                        onClick={() => toggleTraitFilter(traitType, value)}
                                        className={`px-3 py-1.5 rounded-lg font-mono text-[10px] transition-all border ${
                                          isSelected
                                            ? 'bg-dream-cyan/20 text-dream-cyan border-dream-cyan/40'
                                            : 'bg-white/[0.04] text-white/40 border-white/[0.06]'
                                        }`}
                                      >
                                        {value} <span className="opacity-30 ml-1">{count}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-white/5 bg-[#0a0a0c] flex gap-3">
                <button
                  onClick={() => { clearAllFilters(); setShowMobileFilterSheet(false); }}
                  className="flex-1 py-4 rounded-2xl font-mono text-xs font-bold text-white/40 hover:text-white transition-colors border border-white/5"
                >
                  CLEAR ALL
                </button>
                <button
                  onClick={() => setShowMobileFilterSheet(false)}
                  className="flex-[2] py-4 rounded-2xl font-mono text-xs font-bold bg-dream-cyan text-[#0a0a0c] shadow-lg shadow-dream-cyan/20"
                >
                  SHOW RESULTS
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </>
      )}
      {sweepError && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[160] bg-red-500/90 text-white px-4 py-2 rounded-lg font-mono text-xs">
          {sweepError}
        </div>
      )}
    </div>
  );
};

export default TradePage;
