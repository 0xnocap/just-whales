import { useState, useEffect, useCallback } from 'react';
import { useWatchContractEvent } from 'wagmi';
import { api } from '../lib/api';
import { marketplaceAddress, marketplaceAbi } from '../contract';
import type { ActivityFilterKey } from '../types';

const POLL_INTERVAL = 30_000; // 30s fallback poll

export function useActivityFeed(externalFilter?: ActivityFilterKey, onFilterChange?: (f: ActivityFilterKey) => void, refreshKey?: number) {
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalFilter, setInternalFilter] = useState<ActivityFilterKey>('all');

  const filter = externalFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;

  const fetchActivity = useCallback(() => {
    api.activity()
      .then(data => setActivity(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    api.activity()
      .then(data => setActivity(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Fallback poll — keeps cancelled/transfer events eventually consistent
  useEffect(() => {
    const id = setInterval(fetchActivity, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchActivity]);

  // Real-time: prepend Sale events instantly
  useWatchContractEvent({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    eventName: 'Sale',
    onLogs: (logs) => {
      const newItems = logs.map((log: any) => ({
        type: 'sale',
        token_id: Number(log.args?.tokenId ?? 0),
        from: log.args?.seller ?? '',
        to: log.args?.buyer ?? '',
        price: log.args?.price != null ? Number(log.args.price) : null,
        timestamp: Math.floor(Date.now() / 1000),
        transaction_hash: log.transactionHash,
        image_data: null,
      }));
      if (newItems.length > 0) {
        setActivity(prev => [...newItems, ...prev]);
      }
    },
  });

  // Real-time: prepend Listed events instantly
  useWatchContractEvent({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    eventName: 'Listed',
    onLogs: (logs) => {
      const newItems = logs.map((log: any) => ({
        type: 'list',
        token_id: Number(log.args?.tokenId ?? 0),
        from: log.args?.seller ?? '',
        to: null,
        price: log.args?.price != null ? Number(log.args.price) : null,
        timestamp: Math.floor(Date.now() / 1000),
        transaction_hash: log.transactionHash,
        image_data: null,
      }));
      if (newItems.length > 0) {
        setActivity(prev => [...newItems, ...prev]);
      }
    },
  });

  const filtered = filter === 'all' ? activity : activity.filter(i => i.type === filter);

  return { filtered, loading, filter, setFilter, refetch: fetchActivity };
}
