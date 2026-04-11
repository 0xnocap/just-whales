import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { ActivityFilterKey } from '../types';

export function useActivityFeed(externalFilter?: ActivityFilterKey, onFilterChange?: (f: ActivityFilterKey) => void) {
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalFilter, setInternalFilter] = useState<ActivityFilterKey>('all');

  const filter = externalFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;

  useEffect(() => {
    api.activity()
      .then(data => setActivity(Array.isArray(data) ? data : []))
      .catch(() => setActivity([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? activity : activity.filter(i => i.type === filter);

  return { filtered, loading, filter, setFilter };
}
