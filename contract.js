// ============================================
// WHALE TOWN - Contract Deployment Details
// ============================================

// Network: Tempo Mainnet
// Chain ID: 4217
// RPC: https://rpc.tempo.xyz
// NFT Contract: 0x1065ef5996C86C8C90D97974F3c9E5234416839F
// Deployer: 0x49CF10c489E60Bcb405AfE8bC4E577B9D7e3a65C

// Collection: 3333 supply, 3 animal types (Sharks/Whales/SeaLions)
// Fully on-chain: traits stored via SSTORE2, SVG rendered on-chain
// Token naming: "Sharks #0", "Whales #42", "SeaLions #388"

export const WHALE_TOWN_ADDRESS = process.env.NFT_CONTRACT || "0x1065ef5996C86C8C90D97974F3c9E5234416839F";

// Deployed: 2026-04-11 | batchBuy + collection royalty overrides
export const WHALE_TOWN_MARKETPLACE_ADDRESS = process.env.MARKETPLACE_CONTRACT || "0x26CC31587Faa3334e7bbfC9A2255E1c1434fDbBe";

export const PATH_USD_ADDRESS = process.env.PATH_USD_CONTRACT || "0x20c0000000000000000000000000000000000000";

// --- Economy / Points & Staking ---
export const POINTS_CONTRACT_ADDRESS = process.env.POINTS_CONTRACT || "0xCf4A2079A2c058d266A0999F3fCA256d6F1F53a9";
export const STAKING_CONTRACT_ADDRESS = process.env.STAKING_CONTRACT || "0x650F7fd9084b8631e16780A90BBed731679598F0";
export const REWARDS_CLAIMER_CONTRACT_ADDRESS = process.env.REWARDS_CLAIMER_CONTRACT || ""; // To be filled after deploy

export const REWARDS_CLAIMER_ABI = [
  { inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }, { internalType: "uint256", name: "nonce", type: "uint256" }, { internalType: "bytes", name: "signature", type: "bytes" }], name: "claimTradingRewards", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }, { internalType: "uint256", name: "nonce", type: "uint256" }, { internalType: "bytes", name: "signature", type: "bytes" }], name: "claimFishingRewards", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "tradingNonces", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "fishingNonces", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "authorizedSigner", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
];

export const POINTS_ABI = [
  { inputs: [{ internalType: "address", name: "account", type: "address" }], name: "balanceOf", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ internalType: "uint8", name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "name", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "bytes32", name: "role", type: "bytes32" }, { internalType: "address", name: "account", type: "address" }], name: "hasRole", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "MINTER_ROLE", outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }], stateMutability: "view", type: "function" },
];

export const STAKING_ABI = [
  // Reads
  { inputs: [{ internalType: "address", name: "staker", type: "address" }], name: "rewardsOf", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "staker", type: "address" }], name: "stakedTokensOf", outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }], name: "tokenRate", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }], name: "stakerOf", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }], name: "stakedAt", outputs: [{ internalType: "uint64", name: "", type: "uint64" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "pendingRewards", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "paused", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },
  // Writes
  { inputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }], name: "stake", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }], name: "unstake", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "claim", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }, { internalType: "uint256", name: "newRate", type: "uint256" }], name: "setTokenRate", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }, { internalType: "uint256[]", name: "rates", type: "uint256[]" }], name: "setTokenRatesBatch", outputs: [], stateMutability: "nonpayable", type: "function" },
  // Events
  { anonymous: false, inputs: [{ indexed: true, name: "staker", type: "address" }, { indexed: true, name: "tokenId", type: "uint256" }, { indexed: false, name: "rate", type: "uint256" }], name: "Staked", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "staker", type: "address" }, { indexed: true, name: "tokenId", type: "uint256" }, { indexed: false, name: "accruedAtUnstake", type: "uint256" }], name: "Unstaked", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "staker", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "Claimed", type: "event" },
];

export const PATH_USD_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

export const WHALE_TOWN_MARKETPLACE_ABI = [
  // --- Write ---
  {
    "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }],
    "name": "buy",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256[]", "name": "_listingIds", "type": "uint256[]" }],
    "name": "batchBuy",
    "outputs": [{ "internalType": "bool[]", "name": "succeeded", "type": "bool[]" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "_nftContract", "type": "address" },
      { "internalType": "uint256", "name": "_tokenId", "type": "uint256" },
      { "internalType": "uint256", "name": "_price", "type": "uint256" },
      { "internalType": "uint256", "name": "_expiresAt", "type": "uint256" }
    ],
    "name": "list",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }],
    "name": "cancel",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "cancelAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "_nftContract", "type": "address" },
      { "internalType": "address", "name": "_recipient", "type": "address" },
      { "internalType": "uint96", "name": "_bps", "type": "uint96" }
    ],
    "name": "setCollectionRoyalty",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_nftContract", "type": "address" }],
    "name": "clearCollectionRoyalty",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_feeBps", "type": "uint256" }],
    "name": "setPlatformFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_recipient", "type": "address" }],
    "name": "setFeeRecipient",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "_token", "type": "address" },
      { "internalType": "uint256", "name": "_amount", "type": "uint256" }
    ],
    "name": "withdrawERC20",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // --- Read ---
  {
    "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }],
    "name": "getListing",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "seller", "type": "address" },
          { "internalType": "address", "name": "nftContract", "type": "address" },
          { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
          { "internalType": "uint256", "name": "price", "type": "uint256" },
          { "internalType": "uint256", "name": "expiresAt", "type": "uint256" },
          { "internalType": "bool", "name": "active", "type": "bool" }
        ],
        "internalType": "struct WhaleTownMarketplace.Listing",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }],
    "name": "isListingValid",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "listings",
    "outputs": [
      { "internalType": "address", "name": "seller", "type": "address" },
      { "internalType": "address", "name": "nftContract", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "uint256", "name": "price", "type": "uint256" },
      { "internalType": "uint256", "name": "expiresAt", "type": "uint256" },
      { "internalType": "bool", "name": "active", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "collectionRoyalties",
    "outputs": [
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "uint96", "name": "bps", "type": "uint96" },
      { "internalType": "bool", "name": "set", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "_nftContract", "type": "address" },
      { "internalType": "uint256", "name": "_tokenId", "type": "uint256" },
      { "internalType": "uint256", "name": "_price", "type": "uint256" }
    ],
    "name": "getRoyaltyInfo",
    "outputs": [
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextListingId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "platformFeeBps",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "feeRecipient",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  // --- Events ---
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "listingId", "type": "uint256" },
      { "indexed": true, "name": "seller", "type": "address" },
      { "indexed": false, "name": "nftContract", "type": "address" },
      { "indexed": false, "name": "tokenId", "type": "uint256" },
      { "indexed": false, "name": "price", "type": "uint256" },
      { "indexed": false, "name": "expiresAt", "type": "uint256" }
    ],
    "name": "Listed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "listingId", "type": "uint256" },
      { "indexed": true, "name": "buyer", "type": "address" },
      { "indexed": true, "name": "seller", "type": "address" },
      { "indexed": false, "name": "nftContract", "type": "address" },
      { "indexed": false, "name": "tokenId", "type": "uint256" },
      { "indexed": false, "name": "price", "type": "uint256" }
    ],
    "name": "Sale",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "listingId", "type": "uint256" },
      { "indexed": false, "name": "success", "type": "bool" },
      { "indexed": false, "name": "reason", "type": "string" }
    ],
    "name": "BatchBuyResult",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "name": "listingId", "type": "uint256" }],
    "name": "Cancelled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "nftContract", "type": "address" },
      { "indexed": false, "name": "recipient", "type": "address" },
      { "indexed": false, "name": "bps", "type": "uint96" }
    ],
    "name": "CollectionRoyaltySet",
    "type": "event"
  }
];

export const TEMPO_TESTNET = {
  id: 42431,
  name: "Tempo Testnet",
  network: "tempo_testnet",
  nativeCurrency: { name: "pathUSD", symbol: "pathUSD", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.moderato.tempo.xyz"] },
    public: { http: ["https://rpc.moderato.tempo.xyz"] },
  },
};

export const TEMPO_MAINNET = {
  id: 4217,
  name: "Tempo",
  network: "tempo",
  nativeCurrency: { name: "pathUSD", symbol: "pathUSD", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.tempo.xyz"] },
    public: { http: ["https://rpc.tempo.xyz"] },
  },
};

// Mint-relevant ABI (filtered for frontend use)
export const WHALE_TOWN_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "count", type: "uint256" }, { internalType: "bytes32[]", name: "merkleProof", type: "bytes32[]" }],
    name: "mint",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "count", type: "uint256" }, { internalType: "address", name: "recipient", type: "address" }],
    name: "airdrop",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "publicMintPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "allowListPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "maxSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "maxPerAddress",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "maxPerAllowList",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "isPublicMintActive",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "isAllowListActive",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "isMintActive",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "result", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "tokenIdToSVG",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "operator", type: "address" },
      { internalType: "bool", "name": "approved", "type": "bool" }
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "operator", type: "address" }
    ],
    name: "isApprovedForAll",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "contractData",
    outputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "string", name: "description", type: "string" },
      { internalType: "string", name: "image", type: "string" },
      { internalType: "string", name: "banner", type: "string" },
      { internalType: "string", name: "website", type: "string" },
      { internalType: "uint256", name: "royalties", type: "uint256" },
      { internalType: "string", name: "royaltiesRecipient", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "contractURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "tokenDNA",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "dnaUploaded",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "isContractSealed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "addr", type: "address" }, { internalType: "bytes32[]", name: "merkleProof", type: "bytes32[]" }],
    name: "onAllowList",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];
