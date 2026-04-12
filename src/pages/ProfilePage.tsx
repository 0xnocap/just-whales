import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, User, Sparkles, ArrowUpRight, ArrowDownLeft, Clock, Search, Filter, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useAccount, useReadContract } from 'wagmi';
import { useParams } from 'react-router-dom';
import { formatUnits } from 'viem';
import { contractAddress, contractAbi, readTokenURI, decodeTokenURI } from '../contract';
import { truncateAddress, timeAgo, timeUntil } from '../utils/format';
import { api } from '../lib/api';
import BlockiesAvatar from '../components/BlockiesAvatar';
import CopyButton from '../components/CopyButton';
import SkeletonCard from '../components/SkeletonCard';

interface ProfilePageProps {
  onSelectToken: (t: any) => void;
}

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

  // Infinite scroll state
  const BATCH = 20;
  const [nextLoadIndex, setNextLoadIndex] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch true on-chain balance to check against indexer
  const { data: onChainBalance } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'balanceOf',
    args: profileAddress ? [profileAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!profileAddress,
    }
  });

  const trueBalance = onChainBalance ? Number(onChainBalance) : ownedTokenIds.length;
  const isSyncing = trueBalance > ownedTokenIds.length;

  useEffect(() => {
    if (!profileAddress) return;
    setLoading(true);
    
    const fetchProfile = async () => {
      try {
        // Get owned tokens from subgraph
        const data = await api.profile(profileAddress);
        setActivity(data.activity || []);
        
        const ids = data.ownedTokenIds || [];
        setOwnedTokenIds(ids);

        // Fetch metadata for first batch ONLY
        const initialIds = ids.slice(0, BATCH);
        const tokenDetails = [];
        const chunkSize = 10;
        
        for (let i = 0; i < initialIds.length; i += chunkSize) {
          const chunk = initialIds.slice(i, i + chunkSize);
          const chunkResults = await Promise.all(
            chunk.map(async (id: number) => {
              try {
                const uri = await readTokenURI(BigInt(id));
                return { ...decodeTokenURI(uri), id };
              } catch (e) {
                console.error(`Failed to fetch URI for token ${id}:`, e);
                return null;
              }
            })
          );
          tokenDetails.push(...chunkResults);
        }
        
        setOwnedTokens(tokenDetails.filter(Boolean));
        setNextLoadIndex(BATCH);

        // Fetch active listings by this address from DB (fast, avoids O(n) RPC calls)
        try {
          const listingsData = await api.listings(profileAddress);
          if (Array.isArray(listingsData)) {
            const now = BigInt(Math.floor(Date.now() / 1000));
            const userListings = listingsData.map((l: any) => {
              try {
                if (l.expires_at === '0' || now <= BigInt(l.expires_at)) {
                  const metadata = l.metadata || { name: `Token #${l.token_id}`, attributes: [], image_data: '' };
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
            setListings(userListings);
          }
        } catch {}
      } catch (err) { console.error('Profile fetch error:', err); }
      setLoading(false);
    };
    fetchProfile();
  }, [profileAddress]);

  // Infinite scroll observer for collected tab
  useEffect(() => {
    if (tab !== 'collected' || nextLoadIndex >= ownedTokenIds.length) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMoreRef.current) {
        loadingMoreRef.current = true;
        setLoadingMore(true);

        const idsToFetch = ownedTokenIds.slice(nextLoadIndex, nextLoadIndex + BATCH);
        if (idsToFetch.length === 0) {
          setLoadingMore(false);
          loadingMoreRef.current = false;
          return;
        }

        const fetchMore = async () => {
          const chunkDetails = [];
          const chunkSize = 10;
          for (let i = 0; i < idsToFetch.length; i += chunkSize) {
            const chunk = idsToFetch.slice(i, i + chunkSize);
            const chunkResults = await Promise.all(
              chunk.map(async (id: number) => {
                try {
                  const uri = await readTokenURI(BigInt(id));
                  return { ...decodeTokenURI(uri), id };
                } catch { return null; }
              })
            );
            chunkDetails.push(...chunkResults);
          }
          
          setOwnedTokens(prev => [...prev, ...chunkDetails.filter(Boolean)]);
          setNextLoadIndex(prev => prev + BATCH);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        };
        fetchMore();
      }
    }, { rootMargin: '400px' });

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    return () => observer.disconnect();
  }, [tab, nextLoadIndex, ownedTokenIds]);

  // Derive available traits from loaded tokens only — no external JSON needed
  const availableTraits = useMemo(() => {
    const traits: Record<string, Record<string, number>> = {};
    ownedTokens.forEach(token => {
      (token.attributes || []).forEach(({ trait_type, value }: { trait_type: string; value: string }) => {
        if (!traits[trait_type]) traits[trait_type] = {};
        traits[trait_type][value] = (traits[trait_type][value] || 0) + 1;
      });
    });
    return traits;
  }, [ownedTokens]);

  const toggleTraitFilter = (traitType: string, value: string) => {
    setTraitFilters(prev => {
      const current = prev[traitType] || [];
      if (current.includes(value)) {
        const updated = current.filter(v => v !== value);
        if (updated.length === 0) { const { [traitType]: _, ...rest } = prev; return rest; }
        return { ...prev, [traitType]: updated };
      }
      return { ...prev, [traitType]: [...current, value] };
    });
  };

  const clearAllFilters = () => setTraitFilters({});
  const activeFilterCount = (Object.values(traitFilters) as string[][]).reduce((sum, arr) => sum + arr.length, 0);

  const matchesTraitFilter = (token: any) => {
    if (activeFilterCount === 0) return true;
    return (Object.entries(traitFilters) as [string, string[]][]).every(([traitType, values]) => {
      const attr = (token.attributes || []).find((a: any) => a.trait_type === traitType);
      return attr && values.includes(attr.value);
    });
  };

  const filteredOwned = ownedTokens
    .filter(t => matchesTraitFilter(t) && (!profileSearch || t.name?.toLowerCase().includes(profileSearch.toLowerCase()) || String(t.id).includes(profileSearch)))
    .sort((a, b) => profileSort === 'id_asc' ? a.id - b.id : b.id - a.id);

  const filteredListings = listings
    .filter(l => !profileSearch || l.metadata?.name?.toLowerCase().includes(profileSearch.toLowerCase()) || String(Number(l.tokenId)).includes(profileSearch))
    .sort((a, b) => profileSort === 'id_asc' ? Number(a.tokenId) - Number(b.tokenId) : Number(b.tokenId) - Number(a.tokenId));

  if (!profileAddress) {
    return (
      <div className="text-center py-20">
        <User className="w-12 h-12 text-white/10 mx-auto mb-4" />
        <p className="font-mono text-white/30 text-sm">Connect your wallet to view your profile</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
        <BlockiesAvatar address={profileAddress} size={56} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">{truncateAddress(profileAddress)}</h1>
            <CopyButton text={profileAddress} />
            {isOwnProfile && (
              <span className="text-[9px] font-mono text-dream-cyan bg-dream-cyan/10 border border-dream-cyan/20 rounded-full px-2 py-0.5">YOU</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-white/40">
              {trueBalance} items {isSyncing && <span className="text-amber-400/60 text-[10px] ml-1">(indexer syncing...)</span>}
            </span>
            {listings.length > 0 && (
              <span className="text-xs font-mono text-dream-purple/60">{listings.length} listed</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
        {([
          { key: 'collected', label: `Collected (${trueBalance})` },
          { key: 'listed', label: `Listed (${listings.length})` },
          { key: 'activity', label: 'Activity' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer ${
              tab === t.key
                ? 'bg-dream-cyan/15 text-dream-cyan'
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + Sort + Filter toolbar */}
      {!loading && (tab === 'collected' || tab === 'listed') && (
        <>
          <div className="flex items-center gap-2 mb-2">
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
            {/* Filters button — desktop toggles inline panel, mobile opens sheet */}
            {tab === 'collected' && (
              <>
                <button
                  onClick={() => setShowFilters(v => !v)}
                  className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border shrink-0 ${
                    showFilters || activeFilterCount > 0
                      ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30'
                      : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:border-white/20'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>
                <button
                  onClick={() => setShowMobileFilterSheet(true)}
                  className={`md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border shrink-0 ${
                    activeFilterCount > 0
                      ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30'
                      : 'bg-white/[0.03] text-white/40 border-white/[0.06]'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  {activeFilterCount > 0 ? `(${activeFilterCount})` : 'Filter'}
                </button>
              </>
            )}
            <div className="flex gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5 shrink-0">
              {([
                { value: 'id_asc', label: 'ID ↑' },
                { value: 'id_desc', label: 'ID ↓' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setProfileSort(opt.value)}
                  className={`px-3 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer ${
                    profileSort === opt.value
                      ? 'bg-dream-cyan/15 text-dream-cyan'
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* Active filter chips */}
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
              <button onClick={clearAllFilters} className="px-2 py-1 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/30 font-mono text-[10px] hover:text-white/60 transition-colors cursor-pointer">
                Clear all
              </button>
            </div>
          )}
        </>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-dream-cyan w-8 h-8" />
        </div>
      ) : (
        <>
          {/* Collected Tab */}
          {tab === 'collected' && (
            ownedTokens.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
                <p className="font-mono text-white/20 text-[11px] tracking-widest">NO ITEMS</p>
              </div>
            ) : filteredOwned.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
                <p className="font-mono text-white/20 text-[11px] tracking-widest">NO RESULTS</p>
              </div>
            ) : (
              <div className="flex gap-4">
                {/* Desktop trait filter sidebar */}
                {showFilters && Object.keys(availableTraits).length > 0 && (
                  <div className="hidden md:block w-52 flex-shrink-0 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 self-start sticky top-28 max-h-[70vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.15em] font-bold">Traits</span>
                      {activeFilterCount > 0 && (
                        <button onClick={clearAllFilters} className="text-[9px] font-mono text-dream-cyan/60 hover:text-dream-cyan cursor-pointer">Clear</button>
                      )}
                    </div>
                    {Object.entries(availableTraits).map(([traitType, values]) => {
                      const isOpen = openTraitSections[traitType] || false;
                      const selectedValues = traitFilters[traitType] || [];
                      const sortedValues = Object.entries(values).sort((a, b) => b[1] - a[1]);
                      return (
                        <div key={traitType} className="border-b border-white/[0.04] last:border-b-0">
                          <button onClick={() => setOpenTraitSections(prev => ({ ...prev, [traitType]: !isOpen }))} className="w-full flex items-center justify-between py-2.5 text-left cursor-pointer group">
                            <span className="text-[11px] font-mono text-white/60 group-hover:text-white/80 transition-colors">
                              {traitType}{selectedValues.length > 0 && <span className="ml-1 text-dream-cyan">({selectedValues.length})</span>}
                            </span>
                            {isOpen ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
                          </button>
                          {isOpen && (
                            <div className="pb-2.5 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                              {sortedValues.map(([value, count]) => {
                                const isSelected = selectedValues.includes(value);
                                return (
                                  <button key={value} onClick={() => toggleTraitFilter(traitType, value)} className={`flex items-center justify-between px-2 py-1.5 rounded-md text-left cursor-pointer transition-colors font-mono text-[10px] ${isSelected ? 'bg-dream-cyan/15 text-dream-cyan' : 'text-white/40 hover:bg-white/[0.04] hover:text-white/60'}`}>
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
                  <div className={`grid gap-2.5 ${showFilters ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
                    {filteredOwned.map(token => {
                      const isListed = listings.some(l => Number(l.tokenId) === token.id);
                      const listing = listings.find(l => Number(l.tokenId) === token.id);
                      return (
                        <motion.div
                          key={token.id}
                          className="group cursor-pointer rounded-xl overflow-hidden bg-[#111113] hover:bg-[#1a1a1c] transition-colors duration-300"
                          onClick={() => onSelectToken({ ...token, isListing: isListed, listingData: listing, isOwner: isOwnProfile, isSeller: isListed && isOwnProfile, ownerAddress: profileAddress })}
                          whileHover={{ y: -2 }}
                        >
                          <div className="relative aspect-square bg-[#0a0a0c] overflow-hidden">
                            <img src={token.image_data} alt={token.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" style={{ imageRendering: 'pixelated' }} loading="lazy" />
                            {isListed && (
                              <div className="absolute top-2 right-2 bg-dream-cyan/90 text-[#0a0a0c] px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">LISTED</div>
                            )}
                          </div>
                          <div className="px-3 py-2.5">
                            <div className="flex items-baseline justify-between">
                              <h3 className="font-sans font-bold text-white/90 text-[13px] truncate">{token.name.split(' ')[0]}</h3>
                              <span className="font-mono text-[11px] text-white/30 ml-1">{token.name.split(' ')[1]}</span>
                            </div>
                            {isListed && listing && (
                              <span className="font-bold text-white text-[13px]">${Number(formatUnits(listing.price, 6)).toFixed(2)}</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                    {loadingMore && Array.from({ length: Math.min(BATCH, ownedTokenIds.length - ownedTokens.length) }).map((_, i) => (
                      <SkeletonCard key={`skeleton-more-${i}`} />
                    ))}
                  </div>

                  {nextLoadIndex < ownedTokenIds.length && (
                    <>
                      {loadingMore && (
                        <div className="flex items-center justify-center gap-2 py-6">
                          <Loader2 className="w-4 h-4 text-dream-cyan/50 animate-spin" />
                          <span className="font-mono text-white/25 text-[10px] tracking-wider">Loading more...</span>
                        </div>
                      )}
                      <div ref={sentinelRef} className="w-full h-[100px] pointer-events-none opacity-0" />
                    </>
                  )}
                </div>
              </div>
            )
          )}

          {/* Listed Tab */}
          {tab === 'listed' && (
            listings.length === 0 ? (
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
                  <motion.div
                    key={`l-${listing.id}`}
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
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
                {activity.map((item, i) => {
                  const isMint = item.from === '0x0000000000000000000000000000000000000000';
                  const isSent = item.from.toLowerCase() === profileAddress.toLowerCase();
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-3">
                        {isMint ? (
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                        ) : isSent ? (
                          <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-dream-cyan/10 flex items-center justify-center">
                            <ArrowDownLeft className="w-3.5 h-3.5 text-dream-cyan" />
                          </div>
                        )}
                        <div>
                          <span className="text-[12px] font-medium text-white">
                            {isMint ? 'Minted' : isSent ? 'Sent' : 'Received'}
                          </span>
                          <span className="text-[12px] text-white/40 ml-1.5">
                            Token #{item.token_id}
                          </span>
                          <div className="text-[10px] font-mono text-white/25">
                            {isMint ? 'Mint' : `${truncateAddress(item.from)} → ${truncateAddress(item.to)}`}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-white/20">{timeAgo(item.timestamp)}</span>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}

      {/* Mobile trait filter bottom sheet */}
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
                  const selectedValues = traitFilters[traitType] || [];
                  const sortedValues = Object.entries(values).sort((a, b) => b[1] - a[1]);
                  return (
                    <div key={traitType} className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
                      <button onClick={() => setOpenTraitSections(prev => ({ ...prev, [traitType]: !isOpen }))} className="w-full flex items-center justify-between p-4 text-left cursor-pointer">
                        <span className="text-xs font-mono text-white/70">{traitType}{selectedValues.length > 0 && <span className="ml-2 text-dream-cyan">({selectedValues.length})</span>}</span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-white/20" /> : <ChevronDown className="w-4 h-4 text-white/20" />}
                      </button>
                      {isOpen && (
                        <div className="p-4 pt-0 flex flex-wrap gap-1.5">
                          {sortedValues.map(([value, count]) => {
                            const isSelected = selectedValues.includes(value);
                            return (
                              <button key={value} onClick={() => toggleTraitFilter(traitType, value)} className={`px-3 py-1.5 rounded-lg font-mono text-[10px] transition-all border ${isSelected ? 'bg-dream-cyan/20 text-dream-cyan border-dream-cyan/40' : 'bg-white/[0.04] text-white/40 border-white/[0.06]'}`}>
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
