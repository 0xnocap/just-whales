# Whale Town Marketplace

## Deployment

| Field | Value |
|-------|-------|
| Network | Tempo Testnet |
| Chain ID | 42431 |
| RPC | `https://rpc.moderato.tempo.xyz` |
| Contract Address | `0x014b8BAc4E53e384e48965bf95E2E7cbeFB5436f` |
| Deployer/Admin | `0x49CF10c489E60Bcb405AfE8bC4E577B9D7e3a65C` |
| Platform Fee | 1% (100 bps) |
| Fee Recipient | `0x49CF10c489E60Bcb405AfE8bC4E577B9D7e3a65C` |
| Solidity | 0.8.28 |
| Framework | Hardhat 2 |

## NFT Collection

| Field | Value |
|-------|-------|
| NFT Contract | `0x1A8E6629937F4E88315C3a65DC9eC3740e3b567C` (testnet) |
| Standard | ERC721A |
| Royalties | EIP-2981 (auto-enforced by marketplace) |

## How It Works

### Listing
1. Seller approves marketplace: `nft.setApprovalForAll(marketplaceAddress, true)`
2. Seller lists: `marketplace.list(nftContract, tokenId, priceInWei)`
3. Returns a `listingId`

### Buying
1. Buyer calls: `marketplace.buy(listingId)` with exact price as `msg.value`
2. Marketplace distributes funds:
   - 1% platform fee to fee recipient
   - EIP-2981 royalty to creator (capped at 10%)
   - Remainder to seller
3. NFT transferred to buyer

### Cancelling
- Seller calls: `marketplace.cancel(listingId)`
- Owner can also cancel any listing

## Contract Functions

### Write Functions

| Function | Params | Description |
|----------|--------|-------------|
| `list(address, uint256, uint256)` | nftContract, tokenId, price | Create a fixed-price listing |
| `buy(uint256)` | listingId (+ msg.value) | Buy a listed NFT |
| `cancel(uint256)` | listingId | Cancel your listing |
| `setPlatformFee(uint256)` | feeBps | Owner: update fee (max 10%) |
| `setFeeRecipient(address)` | recipient | Owner: update fee recipient |

### Read Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `getListing(uint256)` | Listing struct | Get listing details |
| `listings(uint256)` | seller, nftContract, tokenId, price, active | Direct mapping access |
| `nextListingId()` | uint256 | Total listings created |
| `platformFeeBps()` | uint256 | Current platform fee in bps |
| `feeRecipient()` | address | Current fee recipient |

### Events

| Event | Params | Description |
|-------|--------|-------------|
| `Listed` | listingId, seller, nftContract, tokenId, price | New listing created |
| `Sale` | listingId, buyer, seller, nftContract, tokenId, price | NFT sold |
| `Cancelled` | listingId | Listing cancelled |

## Listing Struct

```solidity
struct Listing {
    address seller;
    address nftContract;
    uint256 tokenId;
    uint256 price;
    bool active;
}
```

## Development

```bash
cd contracts/

# Compile
npx hardhat compile

# Deploy to testnet
npx hardhat run scripts/deploy.js --network tempo_testnet

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network tempo
```

## Environment Variables

```
PRIVATE_KEY=<deployer private key>
TEMPO_TESTNET_RPC=https://rpc.moderato.tempo.xyz  (optional, has default)
TEMPO_RPC=https://rpc.tempo.xyz  (optional, has default)
```
