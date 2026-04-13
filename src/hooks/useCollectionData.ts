import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAccount, useWatchContractEvent } from 'wagmi';
import { formatUnits } from 'viem';
import {
  marketplaceAddress, marketplaceAbi,
  readTotalSupply,
} from '../contract';
import { api } from '../lib/api';
import { TRADE_BATCH } from '../constants/trade';
import type { CollectionData, ActivityFilterKey } from '../types';

export function useCollectionData() {
  const { isConnected, address } = useAccount();
  const [tokens, setTokens] = useState<any[]>([]);
  const [rawListings, setListings] = useState<any[]>([]);
  const [ownerMap, setOwnerMap] = useState<Record<string, string>>({});
  const [totalMinted, setTotalMinted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [nextIdDesc, setNextIdDesc] = useState(-1);
  const [nextIdAsc, setNextIdAsc] = useState(0);
  const [collectionStats, setCollectionStats] = useState<any>(null);

  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [traitFilters, setTraitFilters] = useState<Record<string, string[]>>({});
  
  const [filteredTokens, setFilteredTokens] = useState<any[]>([]);
  const [filteredPage, setFilteredPage] = useState(0);
  const [loadingFiltered, setLoadingFiltered] = useState(false);
  const [filteredMatchIds, setFilteredMatchIds] = useState<number[]>([]);

  const fetchMetadataBatched = async (tokenIds: number[]) => {
    if (tokenIds.length === 0) return {};
    try {
      return await api.metadata(tokenIds);
    } catch (e) {
      console.error('Batch metadata error:', e);
      return {};
    }
  };

  const loadBatchDesc = useCallback(async (fromId: number) => {
    if (fromId < 0) return;
    const endId = Math.max(fromId - TRADE_BATCH + 1, 0);
    const ids: number[] = [];
    for (let i = fromId; i >= endId; i--) ids.push(i);
    
    const metadataMap = await fetchMetadataBatched(ids);
    const valid = ids.map(id => metadataMap[id] ? { ...metadataMap[id], id } : null).filter(Boolean);
    
    setTokens(prev => {
      const newMap = new Map(prev.map((t: any) => [t.id, t]));
      valid.forEach((t: any) => newMap.set(t.id, t));
      return Array.from(newMap.values()).sort((a: any, b: any) => b.id - a.id);
    });
    setNextIdDesc(endId - 1);
  }, []);

  const loadBatchAsc = useCallback(async (fromId: number, maxId: number) => {
    if (fromId >= maxId) return;
    const endId = Math.min(fromId + TRADE_BATCH - 1, maxId - 1);
    const ids: number[] = [];
    for (let i = fromId; i <= endId; i++) ids.push(i);
    
    const metadataMap = await fetchMetadataBatched(ids);
    const valid = ids.map(id => metadataMap[id] ? { ...metadataMap[id], id } : null).filter(Boolean);
    
    setTokens(prev => {
      const newMap = new Map(prev.map((t: any) => [t.id, t]));
      valid.forEach((t: any) => newMap.set(t.id, t));
      return Array.from(newMap.values()).sort((a: any, b: any) => a.id - b.id);
    });
    setNextIdAsc(endId + 1);
  }, []);

  const loadSpecificIds = useCallback(async (ids: number[]) => {
    const metadataMap = await fetchMetadataBatched(ids);
    return ids.map(id => metadataMap[id] ? { ...metadataMap[id], id } : null).filter(Boolean);
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const fetchOwners = api.owners().catch(err => { console.error('Owner fetch error:', err); return {}; });
    const fetchStats = api.stats().catch(err => { console.error('Stats fetch error:', err); return null; });
    const fetchListings = api.listings().catch(err => { console.error('Marketplace fetch error:', err); return []; });
    const fetchSupply = readTotalSupply().catch(err => { console.error('Gallery fetch error:', err); return 0n; });

    fetchOwners.then(data => setOwnerMap(data));
    fetchStats.then(data => setCollectionStats(data));

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
               metadata 
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

    const galleryPromise = fetchSupply.then(async (supply) => {
      const total = Number(supply);
      setTotalMinted(total);
      if (total > 0) {
        await loadBatchDesc(total - 1);
      }
    });

    await Promise.allSettled([listingsPromise, galleryPromise]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [isConnected, address]);

  const refreshListings = useCallback(async () => {
    try {
      const data = await api.listings(undefined, true);
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

  useWatchContractEvent({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    eventName: 'Sale',
    onLogs: (logs) => {
      logs.forEach(log => {
        const listingId = (log as any).args?.listingId;
        if (listingId != null) setListings(prev => prev.filter(l => String(l.id) !== String(listingId)));
      });
      refreshListings();
    },
  });
  useWatchContractEvent({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    eventName: 'Cancelled',
    onLogs: (logs) => {
      logs.forEach(log => {
        const listingId = (log as any).args?.listingId;
        if (listingId != null) setListings(prev => prev.filter(l => String(l.id) !== String(listingId)));
      });
      refreshListings();
    },
  });
  useWatchContractEvent({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    eventName: 'Listed',
    onLogs: () => setTimeout(refreshListings, 1000),
  });

  const handleBuySuccess = useCallback((listingId: bigint | string) => {
    setListings(prev => prev.filter(l => String(l.id) !== String(listingId)));
  }, []);

  useEffect(() => {
    fetch('/collection-data.json')
      .then(r => r.json())
      .then(data => setCollectionData(data))
      .catch(err => console.error('Collection data error:', err));
  }, []);

  const toggleTraitFilter = (traitType: string, value: string) => {
    setTraitFilters(prev => {
      const current = prev[traitType] || [];
      if (current.includes(value)) {
        const updated = current.filter(v => v !== value);
        if (updated.length === 0) {
          const { [traitType]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [traitType]: updated };
      }
      return { ...prev, [traitType]: [...current, value] };
    });
  };

  const clearAllFilters = () => {
    setTraitFilters({});
    setFilteredTokens([]);
    setFilteredPage(0);
    setFilteredMatchIds([]);
  };

  const activeFilterCount = (Object.values(traitFilters) as string[][]).reduce((sum, arr) => sum + arr.length, 0);

  useEffect(() => {
    if (!collectionData || activeFilterCount === 0) {
      setFilteredTokens([]);
      setFilteredMatchIds([]);
      setFilteredPage(0);
      return;
    }

    const matchingIds: number[] = [];
    for (let id = 0; id < collectionData.total; id++) {
      const tokenTraits = collectionData.tokenTraits[String(id)];
      if (!tokenTraits) continue;
      const matches = (Object.entries(traitFilters) as [string, string[]][]).every(([traitType, values]) => {
        return values.includes(tokenTraits[traitType]);
      });
      if (matches) matchingIds.push(id);
    }

    setFilteredMatchIds(matchingIds);
    setFilteredPage(0);
    setFilteredTokens([]);

    if (matchingIds.length > 0) {
      setLoadingFiltered(true);
      const firstBatch = matchingIds.slice(0, TRADE_BATCH);
      loadSpecificIds(firstBatch).then(loaded => {
        setFilteredTokens(loaded as any[]);
        setFilteredPage(1);
        setLoadingFiltered(false);
      });
    }
  }, [traitFilters, collectionData]);

  const loadMoreFiltered = useCallback(async () => {
    if (loadingFiltered || filteredMatchIds.length === 0) return;
    const start = filteredPage * TRADE_BATCH;
    if (start >= filteredMatchIds.length) return;
    setLoadingFiltered(true);
    const batch = filteredMatchIds.slice(start, start + TRADE_BATCH);
    const loaded = await loadSpecificIds(batch);
    setFilteredTokens(prev => [...prev, ...(loaded as any[])]);
    setFilteredPage(prev => prev + 1);
    setLoadingFiltered(false);
  }, [filteredPage, filteredMatchIds, loadingFiltered, loadSpecificIds]);

  // Filter out stale listings where the seller no longer owns the NFT.
  // ownerMap is populated from the DB (which tracks all Transfer events),
  // so if a seller transferred their NFT after listing, ownerMap will reflect the new owner.
  const listings = useMemo(() => {
    if (Object.keys(ownerMap).length === 0) return rawListings;
    return rawListings.filter(l => {
      const currentOwner = ownerMap[Number(l.tokenId)];
      return !currentOwner || currentOwner.toLowerCase() === l.seller.toLowerCase();
    });
  }, [rawListings, ownerMap]);

  return {
    tokens, listings, ownerMap, collectionStats, totalMinted, loading, fetchData,
    loadingMore, setLoadingMore, loadingMoreRef,
    nextIdDesc, nextIdAsc, loadBatchDesc, loadBatchAsc,
    collectionData, traitFilters, toggleTraitFilter, clearAllFilters, activeFilterCount,
    filteredTokens, loadingFiltered, filteredMatchIds, loadMoreFiltered,
    handleBuySuccess, refreshListings
  };
}
