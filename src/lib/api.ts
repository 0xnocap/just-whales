export const api = {
  activity: () =>
    fetch('/api/activity').then(r => r.json()),

  owners: () =>
    fetch('/api/owners').then(r => r.json()),

  listings: (seller?: string) =>
    fetch(seller ? `/api/collection/listings?seller=${seller}` : '/api/collection/listings')
      .then(r => r.json()),

  stats: () =>
    fetch('/api/collection/stats').then(r => r.json()),

  metadata: (ids: number[]) =>
    fetch(`/api/collection/metadata?ids=${ids.join(',')}`).then(r => r.json()),

  tokenHistory: (tokenId: number) =>
    fetch(`/api/token/${tokenId}/history`).then(r => r.json()),

  profile: (address: string) =>
    fetch(`/api/profile/${address}`).then(r => r.json()),
};
