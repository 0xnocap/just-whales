import { test } from 'node:test';

const listings = [{ tokenId: '3333', id: 1, seller: '0x1' }];
const tokens = [{ id: 3333 }, { id: 3332 }];

const unifiedTokens = [
  ...listings.map(l => ({ id: Number(l.tokenId), isListing: true, listingData: l })),
  ...tokens.filter(t => !listings.some(l => Number(l.tokenId) === t.id))
];

console.log('unifiedTokens:', unifiedTokens);

const filter = 'unlisted';
let displayTokens = [...unifiedTokens];

if (filter === 'unlisted') displayTokens = displayTokens.filter(t => !t.isListing);

console.log('displayTokens:', displayTokens);
