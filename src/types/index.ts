import type { TokenMetadata } from '../contract';

export type ModalTokenProps = TokenMetadata & {
  id: number;
  isListing?: boolean;
  listingData?: any;
  isOwner?: boolean;
  isSeller?: boolean;
  ownerAddress?: string;
  refetch?: () => void;
  onBuySuccess?: () => void;
};

export type CollectionData = {
  total: number;
  traitsIndex: Record<string, Record<string, number>>;
  rarityRanks: Record<string, number>;
  rarityScores: Record<string, number>;
  tokenTraits: Record<string, Record<string, string>>;
};

export type ActivityFilterKey = 'all' | 'sale' | 'list' | 'transfer';
