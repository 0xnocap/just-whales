import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { ActivityFilterKey } from '../types';

const POLL_INTERVAL = 15_000; // 15 seconds

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

  // Initial fetch with loading state
  useEffect(() => {
    setLoading(true);
    api.activity()
      .then(data => setActivity(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Poll for new activity
  useEffect(() => {
    const id = setInterval(fetchActivity, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchActivity]);

  const filtered = filter === 'all' ? activity : activity.filter(i => i.type === filter);

  return { filtered, loading, filter, setFilter, refetch: fetchActivity };
}
