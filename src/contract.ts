import { createPublicClient, http } from 'viem';
// @ts-ignore
import { TEMPO_TESTNET, WHALE_TOWN_ADDRESS, WHALE_TOWN_ABI } from '@/contract.js';
import { tempoTestnet } from './wagmi';

const publicClient = createPublicClient({
  chain: tempoTestnet,
  transport: http(TEMPO_TESTNET.rpcUrls.default.http[0]),
});

export const contractAddress = WHALE_TOWN_ADDRESS as `0x${string}`;
export const contractAbi = WHALE_TOWN_ABI;

function read(functionName: string, args?: any[]): Promise<any> {
  return publicClient.readContract({ address: contractAddress, abi: contractAbi, functionName, args } as any);
}

// --- Read helpers ---

export function readTotalSupply(): Promise<bigint> { return read('totalSupply'); }
export function readMaxSupply(): Promise<bigint> { return read('maxSupply'); }
export function readMintPrice(): Promise<bigint> { return read('publicMintPrice'); }
export function readIsPublicMintActive(): Promise<boolean> { return read('isPublicMintActive'); }
export function readMaxPerAddress(): Promise<bigint> { return read('maxPerAddress'); }
export function readTokenURI(tokenId: bigint): Promise<string> { return read('tokenURI', [tokenId]); }
export function readTokenSVG(tokenId: bigint): Promise<string> { return read('tokenIdToSVG', [tokenId]); }
export function readBalanceOf(addr: string): Promise<bigint> { return read('balanceOf', [addr]); }

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
