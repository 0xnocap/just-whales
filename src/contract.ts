import { createPublicClient, http } from 'viem';
// @ts-ignore
import { TEMPO_MAINNET, WHALE_TOWN_ADDRESS, WHALE_TOWN_ABI, WHALE_TOWN_MARKETPLACE_ADDRESS, WHALE_TOWN_MARKETPLACE_ABI, PATH_USD_ADDRESS, PATH_USD_ABI } from '@/contract.js';
import { tempoMainnet } from './wagmi';

const publicClient = createPublicClient({
  chain: tempoMainnet,
  transport: http(TEMPO_MAINNET.rpcUrls.default.http[0]),
});

export const contractAddress = WHALE_TOWN_ADDRESS as `0x${string}`;
export const contractAbi = WHALE_TOWN_ABI;

export const marketplaceAddress = WHALE_TOWN_MARKETPLACE_ADDRESS as `0x${string}`;
export const marketplaceAbi = WHALE_TOWN_MARKETPLACE_ABI;

export const pathUSDAddress = PATH_USD_ADDRESS as `0x${string}`;
export const pathUSDAbi = PATH_USD_ABI;

function read(functionName: string, args?: any[]): Promise<any> {
  return publicClient.readContract({ address: contractAddress, abi: contractAbi, functionName, args } as any);
}

function marketplaceRead(functionName: string, args?: any[]): Promise<any> {
  return publicClient.readContract({ address: marketplaceAddress, abi: marketplaceAbi, functionName, args } as any);
}

function pathUSDRead(functionName: string, args?: any[]): Promise<any> {
  return publicClient.readContract({ address: pathUSDAddress, abi: pathUSDAbi, functionName, args } as any);
}

// --- NFT Read helpers ---

export function readTotalSupply(): Promise<bigint> { return read('totalSupply'); }
export function readMaxSupply(): Promise<bigint> { return read('maxSupply'); }
export function readMintPrice(): Promise<bigint> { return read('publicMintPrice'); }
export function readIsPublicMintActive(): Promise<boolean> { return read('isPublicMintActive'); }
export function readMaxPerAddress(): Promise<bigint> { return read('maxPerAddress'); }
export function readTokenURI(tokenId: bigint): Promise<string> { return read('tokenURI', [tokenId]); }
export function readTokenSVG(tokenId: bigint): Promise<string> { return read('tokenIdToSVG', [tokenId]); }
export function readBalanceOf(addr: string): Promise<bigint> { return read('balanceOf', [addr]); }
export function readOwnerOf(tokenId: bigint): Promise<string> { return read('ownerOf', [tokenId]); }
export function readIsApprovedForAll(owner: string, operator: string): Promise<boolean> { return read('isApprovedForAll', [owner, operator]); }

// --- Marketplace Read helpers ---

export function readNextListingId(): Promise<bigint> { return marketplaceRead('nextListingId'); }
export function readListing(listingId: bigint): Promise<any> { return marketplaceRead('getListing', [listingId]); }
export function readIsListingValid(listingId: bigint): Promise<boolean> { return marketplaceRead('isListingValid', [listingId]); }
export function readMarketplacePaused(): Promise<boolean> { return marketplaceRead('paused'); }
export function readRoyaltyInfo(nftContract: string, tokenId: bigint, price: bigint): Promise<{ recipient: string; amount: bigint }> {
  return marketplaceRead('getRoyaltyInfo', [nftContract, tokenId, price]);
}
export function readCollectionRoyalty(nftContract: string): Promise<{ recipient: string; bps: bigint; set: boolean }> {
  return marketplaceRead('collectionRoyalties', [nftContract]);
}

// --- pathUSD Read helpers ---

export function readPathUSDAllowance(owner: string, spender: string): Promise<bigint> { 
  return pathUSDRead('allowance', [owner, spender]); 
}

// --- Metadata decoder ---

export interface TokenMetadata {
  name: string;
  description: string;
  image_data: string;
  attributes: Array<{ trait_type: string; value: string }>;
}

export function decodeTokenURI(dataUri: string): TokenMetadata {
  const base64 = dataUri.replace('data:application/json;base64,', '');
  return JSON.parse(atob(base64));
}

// --- Tx receipt helper ---

export async function waitForTransaction(hash: `0x${string}`) {
  return publicClient.waitForTransactionReceipt({ hash });
}
