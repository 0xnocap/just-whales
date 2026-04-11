import type { ActivityFilterKey } from '../types';

export const ACTIVITY_FILTERS: { key: ActivityFilterKey; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'sale',     label: 'Sales' },
  { key: 'list',     label: 'Listed' },
  { key: 'transfer', label: 'Transfers' },
];
