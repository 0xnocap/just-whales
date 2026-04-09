# Whale Town - On-Chain Contract Reference

## Deployment

| Field | Value |
|-------|-------|
| Network | Tempo Testnet |
| Chain ID | 42431 |
| RPC | `https://rpc.moderato.tempo.xyz` |
| Contract Address | `0x1A8E6629937F4E88315C3a65DC9eC3740e3b567C` |
| Owner | `0x49CF10c489E60Bcb405AfE8bC4E577B9D7e3a65C` |
| Standard | ERC721A |
| Solidity | 0.8.28 |

Tempo mainnet RPC is `https://rpc.tempo.xyz` (chain ID 4217) for when we redeploy to production.

## Collection Details

- **Supply**: 3333
- **Animal Types**: Sharks (35%), Whales (25%), SeaLions (40%)
- **Fully on-chain**: All 139 trait images (64x64 PNG) stored via SSTORE2. SVG rendered on-chain from trait data. No IPFS dependency.
- **Token naming**: Uses animal type as name prefix. "Sharks #0", "Whales #42", "SeaLions #388"
- **DNA**: Each token has a packed uint32 encoding its animal type + background + 6 trait indices. Pre-generated off-chain, uploaded in batches.

## Current State (Testnet)

- Public mint: ON
- Mint price: 0 (free)
- Max per address: 20
- Tokens minted: 1 (test mint)
- DNA uploaded: Yes (all 3333)
- Traits uploaded: Yes (all 19 layers)
- Contract sealed: No

## Minting

### Public Mint

```js
// mint(count, merkleProof)
// For public mint, pass empty array for merkleProof
await contract.mint(count, [], { value: mintPrice * count })
```

Currently free mint (`publicMintPrice = 0`), so no value needed. If price is set later, calculate with `publicMintPrice()`.

### Allowlist Mint

```js
// Same function, pass valid merkle proof
await contract.mint(count, merkleProof, { value: allowListPrice * count })
```

Owner sets merkle root via `setMerkleRoot(bytes32)`. Check eligibility with `onAllowList(address, proof)`.

## Key Read Functions

| Function | Returns | Use |
|----------|---------|-----|
| `totalSupply()` | uint256 | Current minted count |
| `maxSupply()` | uint256 | Always 3333 |
| `publicMintPrice()` | uint256 | Price in wei |
| `isPublicMintActive()` | bool | Whether public mint is on |
| `isAllowListActive()` | bool | Whether allowlist is on |
| `isMintActive()` | bool | Whether any minting is possible |
| `maxPerAddress()` | uint256 | Max tokens per wallet (currently 20) |
| `balanceOf(address)` | uint256 | How many tokens an address holds |
| `tokenURI(tokenId)` | string | Full on-chain metadata as base64 data URI |
| `tokenIdToSVG(tokenId)` | string | Just the SVG image as base64 data URI |
| `contractData()` | tuple | Collection name, description, image, banner, website, royalties |
| `tokenDNA(tokenId)` | uint32 | Packed DNA for a token |

## Token IDs

ERC721A uses 0-based token IDs. The first minted token is ID 0, the last is 3332. The off-chain generator used 1-based editions (1-3333), so edition N maps to tokenId N-1.

## Rendering

`tokenURI(tokenId)` returns a `data:application/json;base64,...` string. Decoded, it contains:

```json
{
  "name": "SeaLions #0",
  "description": "Welcome To Whale Town",
  "image_data": "data:image/svg+xml;base64,...",
  "attributes": [
    { "trait_type": "Animal Type", "value": "SeaLions" },
    { "trait_type": "Backgrounds", "value": "Clear Sky" },
    { "trait_type": "Base", "value": "Brown" },
    { "trait_type": "Clothing", "value": "AquaHoodie" },
    { "trait_type": "Item", "value": "None" },
    { "trait_type": "HeadAccessories", "value": "None" },
    { "trait_type": "Eyes", "value": "Squinting" },
    { "trait_type": "Mouth", "value": "Pouting" }
  ]
}
```

The `image_data` field is an on-chain SVG (64x64 viewBox) with stacked PNG layers as CSS background-images. To display it, use `<img src={metadata.image_data} />` or render the SVG directly.

`tokenIdToSVG(tokenId)` returns just the `data:image/svg+xml;base64,...` string if you only need the image.

## ABI

The mint-relevant ABI is exported from `contract.js` in this directory. Import as:

```js
import { WHALE_TOWN_ADDRESS, WHALE_TOWN_ABI, TEMPO_TESTNET } from './contract.js'
```

## Tempo Chain Config (for wagmi/viem)

```js
const tempoTestnet = {
  id: 42431,
  name: "Tempo Testnet",
  network: "tempo_testnet",
  nativeCurrency: { name: "TEMPO", symbol: "TEMPO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.moderato.tempo.xyz"] },
    public: { http: ["https://rpc.moderato.tempo.xyz"] },
  },
}
```

## Owner-Only Functions (for reference)

| Function | Purpose |
|----------|---------|
| `togglePublicMint()` | Enable/disable public minting |
| `toggleAllowListMint()` | Enable/disable allowlist |
| `setPublicMintPrice(uint)` | Set mint price in wei |
| `setMaxPerAddress(uint)` | Change max mints per wallet |
| `setMerkleRoot(bytes32)` | Set allowlist merkle root |
| `setContractData(tuple)` | Update collection metadata |
| `sealContract()` | Permanently lock trait data (irreversible) |
| `withdraw()` | Withdraw contract balance to owner |

## Source Files

- Contract: `/Users/zacharymilo/Documents/onchain_contracts/contracts/WhaleTown.sol`
- Full ABI: `/Users/zacharymilo/Documents/onchain_contracts/artifacts/contracts/WhaleTown.sol/WhaleTown.json`
- Deploy script: `/Users/zacharymilo/Documents/onchain_contracts/scripts/deployWhaleTown.js`
- Trait upload: `/Users/zacharymilo/Documents/onchain_contracts/scripts/uploadWhaleTownTraits.js`
- DNA upload: `/Users/zacharymilo/Documents/onchain_contracts/scripts/uploadWhaleTownDNA.js`
- DNA data: `/Users/zacharymilo/Documents/onchain_contracts/whale-town-dna.json`
- 64px traits: `/Users/zacharymilo/Documents/GenV5/projects/Tempocean/TRAITS_64px/`
- Generated metadata: `/Users/zacharymilo/Documents/GenV5/projects/Tempocean/OUTPUT/metadata/`
