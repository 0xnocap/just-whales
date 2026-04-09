// ============================================
// WHALE TOWN - Contract Deployment Details
// ============================================

// Network: Tempo Testnet
// Chain ID: 42431
// RPC: https://rpc.moderato.tempo.xyz
// Contract: 0x1A8E6629937F4E88315C3a65DC9eC3740e3b567C
// Deployer: 0x49CF10c489E60Bcb405AfE8bC4E577B9D7e3a65C

// Collection: 3333 supply, 3 animal types (Sharks/Whales/SeaLions)
// Fully on-chain: traits stored via SSTORE2, SVG rendered on-chain
// Mint price: 0 (free mint, configurable by owner)
// Token naming: "Sharks #0", "Whales #42", "SeaLions #388"

export const WHALE_TOWN_ADDRESS = "0x1A8E6629937F4E88315C3a65DC9eC3740e3b567C";

export const TEMPO_TESTNET = {
  id: 42431,
  name: "Tempo Testnet",
  network: "tempo_testnet",
  nativeCurrency: { name: "TEMPO", symbol: "TEMPO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.moderato.tempo.xyz"] },
    public: { http: ["https://rpc.moderato.tempo.xyz"] },
  },
};

export const TEMPO_MAINNET = {
  id: 4217,
  name: "Tempo",
  network: "tempo",
  nativeCurrency: { name: "TEMPO", symbol: "TEMPO", decimals: 18 },
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
