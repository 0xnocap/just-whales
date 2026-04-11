import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { ActivityFilterKey } from '../types';

export function useActivityFeed(externalFilter?: ActivityFilterKey, onFilterChange?: (f: ActivityFilterKey) => void, refreshKey?: number) {
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalFilter, setInternalFilter] = useState<ActivityFilterKey>('all');

  const filter = externalFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;

  const fetchActivity = useCallback(() => {
    setLoading(true);
    api.activity()
      .then(data => setActivity(Array.isArray(data) ? data : []))
      .catch(() => setActivity([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity, refreshKey]);

  const filtered = filter === 'all' ? activity : activity.filter(i => i.type === filter);

  return { filtered, loading, filter, setFilter, refetch: fetchActivity };
}
