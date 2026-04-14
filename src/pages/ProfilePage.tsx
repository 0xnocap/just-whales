import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Search, Filter, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useAccount, useReadContract } from 'wagmi';
import { useParams } from 'react-router-dom';
import { formatUnits } from 'viem';
import { contractAddress, contractAbi } from '../contract';
import { truncateAddress, timeAgo, timeUntil } from '../utils/format';
import { api } from '../lib/api';
import ActivityItem from '../components/ActivityItem';
import CopyButton from '../components/CopyButton';
import { createIcon } from '@iconoma-icons/core';
import { pixel, palettes } from '@iconoma-icons/collection';
import SkeletonCard from '../components/SkeletonCard';
import type { CollectionData } from '../types';

interface ProfilePageProps {
  onSelectToken: (t: any) => void;
}

const BATCH = 20;

const ProfilePage: React.FC<ProfilePageProps> = ({ onSelectToken }) => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { address: paramAddress } = useParams<{ address: string }>();
  const profileAddress = paramAddress || connectedAddress || '';
  const isOwnProfile = isConnected && connectedAddress?.toLowerCase() === profileAddress.toLowerCase();

  const [tab, setTab] = useState<'collected' | 'listed' | 'activity'>('collected');
  const [ownedTokenIds, setOwnedTokenIds] = useState<number[]>([]);
  const [ownedTokens, setOwnedTokens] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileSearch, setProfileSearch] = useState('');
  const [profileSort, setProfileSort] = useState<'id_asc' | 'id_desc'>('id_asc');
  const [traitFilters, setTraitFilters] = useState<Record<string, string[]>>({});
  const [showMobileFilterSheet, setShowMobileFilterSheet] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [openTraitSections, setOpenTraitSections] = useState<Record<string, boolean>>({});
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);

  // Filtered state
  const [filteredOwnedTokens, setFilteredOwnedTokens] = useState<any[]>([]);
  const [filteredMatchIds, setFilteredMatchIds] = useState<number[]>([]);
  const [filteredPage, setFilteredPage] = useState(0);
  const [loadingFiltered, setLoadingFiltered] = useState(false);

  // Infinite scroll state
  const [nextLoadIndex, setNextLoadIndex] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: onChainBalance } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'balanceOf',
    args: profileAddress ? [profileAddress as `0x${string}`] : undefined,
    query: { enabled: !!profileAddress },
  });

  const trueBalance = onChainBalance ? Number(onChainBalance) : ownedTokenIds.length;
  const isSyncing = trueBalance > ownedTokenIds.length;

  useEffect(() => {
    fetch('/collection-data.json')
      .then(r => r.json())
      .then(setCollectionData)
      .catch(() => {});
  }, []);

  // Profile fetch — loads first batch fast, rest via scroll
  useEffect(() => {
    if (!profileAddress) return;
    setLoading(true);
    setOwnedTokens([]);
    setOwnedTokenIds([]);
    setNextLoadIndex(0);
    setTraitFilters({});
    setFilteredOwnedTokens([]);
    setFilteredMatchIds([]);
    setFilteredPage(0);

    const run = async () => {
      try {
        const [profileData, listingsData] = await Promise.all([
          api.profile(profileAddress),
          api.listings(profileAddress).catch(() => []),
        ]);

        setActivity(profileData.activity || []);

        const ids: number[] = profileData.ownedTokenIds || [];
        setOwnedTokenIds(ids);

        // Load first batch immediately so the page shows fast
        if (ids.length > 0) {
          const metadataMap = await api.metadata(ids.slice(0, BATCH));
          const tokens = ids.slice(0, BATCH)
            .map(id => metadataMap[id] ? { ...metadataMap[id], id } : null)
            .filter(Boolean);
          setOwnedTokens(tokens as any[]);
        }
        setNextLoadIndex(BATCH);

        if (Array.isArray(listingsData)) {
          const now = BigInt(Math.floor(Date.now() / 1000));
          const active = (listingsData as any[]).map((l: any) => {
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
            } catch { return null; }
            return null;
          }).filter(Boolean);

          // Backfill image_data for listings
          const listedIds = (active as any[]).map((l: any) => Number(l.token_id));
          if (listedIds.length > 0) {
            const metadataMap = await api.metadata(listedIds);
            (active as any[]).forEach((l: any) => {
              const meta = metadataMap[Number(l.token_id)];
              if (meta?.image_data && l.metadata) {
                l.metadata = { ...l.metadata, image_data: meta.image_data };
              }
            });
          }

          setListings(active);
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      }
      setLoading(false);
    };

    run();
  }, [profileAddress]);

  // Trait filter — load all matches at once (subset of owned, fast)
  const activeFilterCount = (Object.values(traitFilters) as string[][]).reduce((sum, arr) => sum + arr.length, 0);

  useEffect(() => {
    if (!collectionData || activeFilterCount === 0) {
      setFilteredMatchIds([]);
      setFilteredOwnedTokens([]);
      setFilteredPage(0);
      return;
    }

    const matchingIds = ownedTokenIds.filter(id => {
      const tt = collectionData.tokenTraits[String(id)];
      if (!tt) return false;
      return (Object.entries(traitFilters) as [string, string[]][]).every(
        ([type, vals]) => vals.includes(tt[type])
      );
    });

    setFilteredMatchIds(matchingIds);
    setFilteredPage(0);
    setFilteredOwnedTokens([]);
    if (matchingIds.length === 0) return;

    setLoadingFiltered(true);
    api.metadata(matchingIds.slice(0, BATCH))
      .then(map => {
        const tokens = matchingIds.slice(0, BATCH)
          .map(id => map[id] ? { ...map[id], id } : null)
          .filter(Boolean);
        setFilteredOwnedTokens(tokens as any[]);
        setFilteredPage(1);
      })
      .catch(() => {})
      .finally(() => setLoadingFiltered(false));
  }, [traitFilters, collectionData, ownedTokenIds]);

  // Scroll sentinel — same pattern as TradePage's TradeScrollSentinel
  const hasMoreUnfiltered = activeFilterCount === 0 && nextLoadIndex < ownedTokenIds.length;
  const hasMoreFiltered = activeFilterCount > 0 && filteredOwnedTokens.length < filteredMatchIds.length;
  const hasMore = hasMoreUnfiltered || hasMoreFiltered;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      const doLoad = async () => {
        try {
          if (activeFilterCount > 0) {
            const start = filteredPage * BATCH;
            const batch = filteredMatchIds.slice(start, start + BATCH);
            if (batch.length === 0) return;
            const map = await api.metadata(batch);
            const tokens = batch.map(id => map[id] ? { ...map[id], id } : null).filter(Boolean);
            setFilteredOwnedTokens(prev => [...prev, ...(tokens as any[])]);
            setFilteredPage(p => p + 1);
          } else {
            const batch = ownedTokenIds.slice(nextLoadIndex, nextLoadIndex + BATCH);
            if (batch.length === 0) return;
            const map = await api.metadata(batch);
            const tokens = batch.map(id => map[id] ? { ...map[id], id } : null).filter(Boolean);
            setOwnedTokens(prev => [...prev, ...(tokens as any[])]);
            setNextLoadIndex(n => n + BATCH);
          }
        } finally {
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      };
      doLoad();
    }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, nextLoadIndex, ownedTokenIds, filteredPage, filteredMatchIds, activeFilterCount]);

  const availableTraits = useMemo(() => {
    if (!collectionData) return {};
    const traits: Record<string, Record<string, number>> = {};
    ownedTokenIds.forEach(id => {
      const tt = collectionData.tokenTraits[String(id)];
      if (!tt) return;
      (Object.entries(tt) as [string, string][]).forEach(([type, val]) => {
        if (!traits[type]) traits[type] = {};
        traits[type][val] = (traits[type][val] || 0) + 1;
      });
    });
    return traits;
  }, [collectionData, ownedTokenIds]);

  const toggleTraitFilter = (traitType: string, value: string) => {
    setTraitFilters(prev => {
      const cur = prev[traitType] || [];
      if (cur.includes(value)) {
        const next = cur.filter(v => v !== value);
        if (next.length === 0) { const { [traitType]: _, ...rest } = prev; return rest; }
        return { ...prev, [traitType]: next };
      }
      return { ...prev, [traitType]: [...cur, value] };
    });
  };

  const clearAllFilters = () => setTraitFilters({});

  const sourceTokens = activeFilterCount > 0 ? filteredOwnedTokens : ownedTokens;
  const filteredOwned = sourceTokens
    .filter(t => !profileSearch || t.name?.toLowerCase().includes(profileSearch.toLowerCase()) || String(t.id).includes(profileSearch))
    .sort((a, b) => profileSort === 'id_asc' ? a.id - b.id : b.id - a.id);

  const filteredListings = listings
    .filter(l => !profileSearch || l.metadata?.name?.toLowerCase().includes(profileSearch.toLowerCase()) || String(Number(l.tokenId)).includes(profileSearch))
    .sort((a, b) => profileSort === 'id_asc' ? Number(a.tokenId) - Number(b.tokenId) : Number(b.tokenId) - Number(a.tokenId));

  // Skeleton count for "remaining" items after real cards
  const skeletonTail = activeFilterCount > 0
    ? Math.min(BATCH, filteredMatchIds.length - filteredOwnedTokens.length)
    : Math.min(BATCH, ownedTokenIds.length - ownedTokens.length);

  // Avatar + banner
  const addrHash = profileAddress.toLowerCase();
  const addrSeed = parseInt(addrHash.slice(2, 6) || '0', 16);
  const paletteList = [palettes.neon, palettes.candy, palettes.pastel];
  const avatarPalette = [...paletteList[addrSeed % paletteList.length]] as string[];
  const avatarLg = profileAddress ? createIcon(pixel, { seed: addrHash, size: 96, colors: avatarPalette }).toDataUri() : '';
  const avatarSm = profileAddress ? createIcon(pixel, { seed: addrHash, size: 44, colors: avatarPalette }).toDataUri() : '';
  const hue1 = parseInt(addrHash.slice(2, 6) || '0', 16) % 360;
  const hue2 = parseInt(addrHash.slice(6, 10) || '0', 16) % 360;
  const midHue = Math.round((hue1 + hue2) / 2);
  const bannerStyle = profileAddress
    ? { background: `linear-gradient(135deg, hsl(${hue1},55%,18%) 0%, hsl(${midHue},50%,12%) 50%, hsl(${hue2},45%,8%) 100%)` }
    : { background: 'linear-gradient(135deg, #1a1a2e, #0f0f1a)' };

  const hasSidebar = showFilters && Object.keys(availableTraits).length > 0;
  const gridCls = hasSidebar
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

  if (!profileAddress) {
    return (
      <div className="text-center py-20">
        <div className="w-12 h-12 rounded-full bg-white/5 mx-auto mb-4" />
        <p className="font-mono text-white/30 text-sm">Connect your wallet to view your profile</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden mb-2" style={{ minHeight: 'clamp(130px, 20vw, 240px)' }}>
        <div className="absolute inset-0" style={bannerStyle} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-6 pb-4 md:pb-6">
          {/* Desktop */}
          <div className="hidden md:flex items-end justify-between gap-6">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/10 flex-shrink-0">
                <img src={avatarLg} alt="avatar" width={96} height={96} style={{ imageRendering: 'pixelated', display: 'block' }} />
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-black text-white tracking-tight">{truncateAddress(profileAddress)}</h1>
                  {isOwnProfile && <span className="text-[9px] font-mono text-dream-cyan bg-dream-cyan/10 border border-dream-cyan/20 rounded-full px-2 py-0.5">YOU</span>}
                  <CopyButton text={profileAddress} />
                </div>
                <p className="text-white/50 text-[13px] font-mono">
                  {trueBalance} items collected on Tempo
                  {isSyncing && <span className="text-amber-400/60 ml-2">(indexer syncing...)</span>}
                </p>
              </div>
            </div>
            <div className="flex items-end gap-5 pb-1">
              {[
                { label: 'Items',  value: trueBalance.toString() },
                { label: 'Listed', value: listings.length.toString() },
              ].map(stat => (
                <div key={stat.label} className="text-right">
                  <div className="text-[10px] font-mono text-white/40 uppercase tracking-[0.1em]">{stat.label}</div>
                  <div className="text-[15px] font-bold text-white leading-none mt-0.5">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Mobile */}
          <div className="md:hidden flex items-end justify-between gap-3">
            <div className="flex items-end gap-2.5 min-w-0">
              <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                <img src={avatarSm} alt="avatar" width={44} height={44} style={{ imageRendering: 'pixelated', display: 'block' }} />
              </div>
              <div className="min-w-0 pb-0.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-black text-[15px] text-white leading-none">{truncateAddress(profileAddress)}</span>
                  {isOwnProfile && <span className="text-[8px] font-mono text-dream-cyan bg-dream-cyan/10 border border-dream-cyan/20 rounded-full px-1.5 py-0.5">YOU</span>}
                </div>
                <p className="text-[9px] font-mono text-white/40 truncate">{trueBalance} items collected on Tempo</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-shrink-0 pb-0.5">
              {[
                { label: 'Items',  value: trueBalance.toString() },
                { label: 'Listed', value: listings.length.toString() },
              ].map(stat => (
                <div key={stat.label} className="text-right">
                  <div className="text-[7px] font-mono uppercase tracking-widest text-white/30">{stat.label}</div>
                  <div className="text-[13px] font-black text-white leading-none mt-0.5">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-2 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
        {([
          { key: 'collected', label: `Collected (${trueBalance})` },
          { key: 'listed',    label: `Listed (${listings.length})` },
          { key: 'activity',  label: 'Activity' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer ${tab === t.key ? 'bg-dream-cyan/15 text-dream-cyan' : 'text-white/30 hover:text-white/60'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar — always visible */}
      {(tab === 'collected' || tab === 'listed') && (
        <>
          <div className="flex items-center gap-2 mb-2">
            {/* Filters LEFT of search */}
            {tab === 'collected' && (
              <>
                <button
                  onClick={() => setShowFilters(v => !v)}
                  className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border shrink-0 ${showFilters || activeFilterCount > 0 ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30' : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:border-white/20'}`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>
                <button
                  onClick={() => setShowMobileFilterSheet(true)}
                  className={`md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border shrink-0 ${activeFilterCount > 0 ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30' : 'bg-white/[0.03] text-white/40 border-white/[0.06]'}`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  {activeFilterCount > 0 ? `(${activeFilterCount})` : 'Filter'}
                </button>
              </>
            )}
            <div className="relative flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-3.5 h-3.5 text-white/20" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={profileSearch}
                onChange={e => setProfileSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg font-mono text-[11px] text-white placeholder:text-white/20 focus:border-dream-cyan/30 outline-none transition-all"
              />
            </div>
            <div className="flex gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5 shrink-0">
              {([{ value: 'id_asc', label: 'ID ↑' }, { value: 'id_desc', label: 'ID ↓' }] as const).map(opt => (
                <button key={opt.value} onClick={() => setProfileSort(opt.value)}
                  className={`px-3 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer ${profileSort === opt.value ? 'bg-dream-cyan/15 text-dream-cyan' : 'text-white/30 hover:text-white/60'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(Object.entries(traitFilters) as [string, string[]][]).map(([traitType, values]) =>
                values.map(value => (
                  <button key={`${traitType}-${value}`} onClick={() => toggleTraitFilter(traitType, value)}
                    className="flex items-center gap-1 px-2 py-1 bg-dream-cyan/10 border border-dream-cyan/20 rounded-lg text-dream-cyan font-mono text-[10px] hover:bg-dream-cyan/20 transition-colors cursor-pointer"
                  >
                    <span className="text-dream-cyan/50">{traitType}:</span> {value}
                    <X className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                ))
              )}
              <button onClick={clearAllFilters} className="px-2 py-1 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/30 font-mono text-[10px] hover:text-white/60 transition-colors cursor-pointer">
                Clear all
              </button>
            </div>
          )}
        </>
      )}

      {/* Collected Tab */}
      {tab === 'collected' && (
        loading ? (
          // Initial skeleton grid — sized to on-chain balance or sensible default
          <div className={`grid gap-2.5 ${gridCls}`}>
            {Array.from({ length: Math.min(trueBalance || BATCH, BATCH) }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : ownedTokenIds.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
            <p className="font-mono text-white/20 text-[11px] tracking-widest">NO ITEMS</p>
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Desktop sidebar */}
            {hasSidebar && (
              <div className="hidden md:block w-52 flex-shrink-0 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 self-start sticky top-28 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.15em] font-bold">Traits</span>
                  {activeFilterCount > 0 && <button onClick={clearAllFilters} className="text-[9px] font-mono text-dream-cyan/60 hover:text-dream-cyan cursor-pointer">Clear</button>}
                </div>
                {Object.entries(availableTraits).map(([traitType, values]) => {
                  const isOpen = openTraitSections[traitType] || false;
                  const sel = traitFilters[traitType] || [];
                  return (
                    <div key={traitType} className="border-b border-white/[0.04] last:border-b-0">
                      <button onClick={() => setOpenTraitSections(p => ({ ...p, [traitType]: !isOpen }))} className="w-full flex items-center justify-between py-2.5 text-left cursor-pointer group">
                        <span className="text-[11px] font-mono text-white/60 group-hover:text-white/80 transition-colors">
                          {traitType}{sel.length > 0 && <span className="ml-1 text-dream-cyan">({sel.length})</span>}
                        </span>
                        {isOpen ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
                      </button>
                      {isOpen && (
                        <div className="pb-2.5 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                          {Object.entries(values).sort((a, b) => b[1] - a[1]).map(([value, count]) => {
                            const isSel = sel.includes(value);
                            return (
                              <button key={value} onClick={() => toggleTraitFilter(traitType, value)}
                                className={`flex items-center justify-between px-2 py-1.5 rounded-md text-left cursor-pointer transition-colors font-mono text-[10px] ${isSel ? 'bg-dream-cyan/15 text-dream-cyan' : 'text-white/40 hover:bg-white/[0.04] hover:text-white/60'}`}
                              >
                                <span className="truncate">{value}</span>
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
              {activeFilterCount > 0 && loadingFiltered && filteredOwnedTokens.length === 0 ? (
                // Skeleton grid while first filtered batch loads
                <div className={`grid gap-2.5 ${gridCls}`}>
                  {Array.from({ length: Math.min(filteredMatchIds.length || BATCH, BATCH) }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : filteredOwned.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
                  <p className="font-mono text-white/20 text-[11px] tracking-widest">
                    {activeFilterCount > 0 ? 'NO MATCHING TOKENS' : 'NO RESULTS'}
                  </p>
                </div>
              ) : (
                <>
                  <div className={`grid gap-2.5 ${gridCls}`}>
                    {filteredOwned.map(token => {
                      const listing = listings.find(l => Number(l.tokenId) === token.id);
                      const isListed = !!listing;
                      return (
                        <motion.div
                          key={token.id}
                          className="group cursor-pointer rounded-xl overflow-hidden bg-[#111113] hover:bg-[#1a1a1c] transition-colors duration-300"
                          onClick={() => onSelectToken({ ...token, isListing: isListed, listingData: listing, isOwner: isOwnProfile, isSeller: isListed && isOwnProfile, ownerAddress: profileAddress })}
                          whileHover={{ y: -2 }}
                        >
                          <div className="relative aspect-square bg-[#0a0a0c] overflow-hidden">
                            <img src={token.image_data} alt={token.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" style={{ imageRendering: 'pixelated' }} loading="lazy" />
                            {isListed && <div className="absolute top-2 right-2 bg-dream-cyan/90 text-[#0a0a0c] px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">LISTED</div>}
                          </div>
                          <div className="px-3 py-2.5">
                            <div className="flex items-baseline justify-between">
                              <h3 className="font-sans font-bold text-white/90 text-[13px] truncate">{token.name.split(' ')[0]}</h3>
                              <span className="font-mono text-[11px] text-white/30 ml-1">{token.name.split(' ')[1]}</span>
                            </div>
                            {isListed && listing && <span className="font-bold text-white text-[13px]">${Number(formatUnits(listing.price, 6)).toFixed(2)}</span>}
                          </div>
                        </motion.div>
                      );
                    })}
                    {/* Skeleton tail — same grid, shows next batch as placeholder before sentinel fires */}
                    {(loadingMore || hasMore) && Array.from({ length: skeletonTail }).map((_, i) => (
                      <SkeletonCard key={`tail-${i}`} />
                    ))}
                  </div>
                  {/* Invisible sentinel — fires 600px early, same as TradeScrollSentinel */}
                  {hasMore && <div ref={sentinelRef} className="h-1 w-full" />}
                </>
              )}
            </div>
          </div>
        )
      )}

      {/* Listed Tab */}
      {tab === 'listed' && (
        loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {Array.from({ length: Math.min(listings.length || 6, BATCH) }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
            <p className="font-mono text-white/20 text-[11px] tracking-widest">NO ACTIVE LISTINGS</p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
            <p className="font-mono text-white/20 text-[11px] tracking-widest">NO RESULTS</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {filteredListings.map(listing => (
              <motion.div key={`l-${listing.id}`}
                className="group cursor-pointer rounded-xl overflow-hidden bg-[#111113] hover:bg-[#1a1a1c] transition-colors duration-300"
                onClick={() => onSelectToken({ ...listing.metadata, id: Number(listing.tokenId), isListing: true, listingData: listing, isOwner: isOwnProfile, isSeller: isOwnProfile, ownerAddress: profileAddress })}
                whileHover={{ y: -2 }}
              >
                <div className="relative aspect-square bg-[#0a0a0c] overflow-hidden">
                  <img src={listing.metadata.image_data} alt={listing.metadata.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" style={{ imageRendering: 'pixelated' }} />
                  <div className="absolute top-2 right-2 bg-dream-cyan/90 text-[#0a0a0c] px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">LISTED</div>
                </div>
                <div className="px-3 py-2.5">
                  <h3 className="font-sans font-bold text-white/90 text-[13px] truncate mb-1">{listing.metadata.name}</h3>
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold text-white text-[14px]">${Number(formatUnits(listing.price, 6)).toFixed(2)}</span>
                    {listing.expiresAt > 0n && (
                      <span className="text-[9px] font-mono text-white/20 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />{timeUntil(Number(listing.expiresAt))}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* Activity Tab */}
      {tab === 'activity' && (
        activity.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
            <p className="font-mono text-white/20 text-[11px] tracking-widest">NO ACTIVITY</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {activity.map((item, i) => (
              <ActivityItem key={`${item.transaction_hash}-${item.type}-${i}`} item={item} />
            ))}
          </div>
        )
      )}

      {/* Mobile filter sheet */}
      <AnimatePresence>
        {showMobileFilterSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMobileFilterSheet(false)} className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-sm md:hidden" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-[170] bg-[#0a0a0c] border-t border-white/10 rounded-t-3xl max-h-[85vh] flex flex-col md:hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-dream-cyan" />
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-widest">Traits</h2>
                </div>
                <button onClick={() => setShowMobileFilterSheet(false)} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-white/40 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-2 pb-32">
                {Object.entries(availableTraits).map(([traitType, values]) => {
                  const isOpen = openTraitSections[traitType] || false;
                  const sel = traitFilters[traitType] || [];
                  return (
                    <div key={traitType} className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
                      <button onClick={() => setOpenTraitSections(p => ({ ...p, [traitType]: !isOpen }))} className="w-full flex items-center justify-between p-4 text-left cursor-pointer">
                        <span className="text-xs font-mono text-white/70">{traitType}{sel.length > 0 && <span className="ml-2 text-dream-cyan">({sel.length})</span>}</span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-white/20" /> : <ChevronDown className="w-4 h-4 text-white/20" />}
                      </button>
                      {isOpen && (
                        <div className="p-4 pt-0 flex flex-wrap gap-1.5">
                          {Object.entries(values).sort((a, b) => b[1] - a[1]).map(([value, count]) => {
                            const isSel = sel.includes(value);
                            return (
                              <button key={value} onClick={() => toggleTraitFilter(traitType, value)}
                                className={`px-3 py-1.5 rounded-lg font-mono text-[10px] transition-all border ${isSel ? 'bg-dream-cyan/20 text-dream-cyan border-dream-cyan/40' : 'bg-white/[0.04] text-white/40 border-white/[0.06]'}`}
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
              <div className="p-5 border-t border-white/5 bg-[#0a0a0c] flex gap-3">
                <button onClick={() => { clearAllFilters(); setShowMobileFilterSheet(false); }} className="flex-1 py-4 rounded-2xl font-mono text-xs font-bold text-white/40 border border-white/5">CLEAR ALL</button>
                <button onClick={() => setShowMobileFilterSheet(false)} className="flex-[2] py-4 rounded-2xl font-mono text-xs font-bold bg-dream-cyan text-[#0a0a0c] shadow-lg shadow-dream-cyan/20">SHOW RESULTS</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfilePage;
