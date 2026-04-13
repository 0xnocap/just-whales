export const api = {
  activity: () =>
    fetch('/api/activity').then(r => r.json()),

  owners: () =>
    fetch('/api/owners').then(r => r.json()),

  listings: (seller?: string, skipCache?: boolean) => {
    let url = seller ? `/api/collection/listings?seller=${seller}` : '/api/collection/listings';
    if (skipCache) {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}v=${Date.now()}`;
    }
    return fetch(url).then(r => r.json());
  },

  stats: () =>
    fetch('/api/collection/stats').then(r => r.json()),

  metadata: (ids: number[]) =>
    fetch(`/api/collection/metadata?ids=${ids.join(',')}`).then(r => r.json()),

  tokenHistory: (tokenId: number) =>
    fetch(`/api/token/${tokenId}/history`).then(r => r.json()),

  profile: (address: string) =>
    fetch(`/api/profile/${address}`).then(r => r.json()),

  cancelListing: (listingId: string | number, hash?: string) =>
    fetch('/api/collection/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, transactionHash: hash })
    }).then(r => r.json()),

  saleListing: (listingId: string | number, buyer: string, hash?: string) =>
    fetch('/api/collection/sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, buyer, transactionHash: hash })
    }).then(r => r.json()),
};
