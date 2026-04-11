export const TRADE_BATCH = 50;

export const SORT_OPTIONS = [
  { value: 'price_asc',   label: 'Price: Low → High' },
  { value: 'price_desc',  label: 'Price: High → Low' },
  { value: 'id_asc',      label: 'Token ID ↑' },
  { value: 'id_desc',     label: 'Token ID ↓' },
  { value: 'rarity_asc',  label: 'Rarity: Rare First' },
  { value: 'rarity_desc', label: 'Rarity: Common First' },
] as const;

export type SortOption = typeof SORT_OPTIONS[number]['value'];
