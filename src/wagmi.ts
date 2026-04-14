import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain, http, webSocket, fallback } from 'viem';
// @ts-ignore
import { TEMPO_MAINNET, TEMPO_TESTNET } from '@/contract.js';

const chainId = Number(process.env.CHAIN_ID || TEMPO_MAINNET.id);
const activeChainDef = chainId === TEMPO_TESTNET.id ? TEMPO_TESTNET : TEMPO_MAINNET;

const customRpc: string = process.env.ALCHEMY_TEMPO_RPC || process.env.RPC_URL || '';
const alchemyWs: string = process.env.ALCHEMY_TEMPO_WEBSOCKET || '';
const publicRpc: string = activeChainDef.rpcUrls.default.http[0];

export const activeChain = defineChain({
  id: activeChainDef.id,
  name: activeChainDef.name,
  network: activeChainDef.network,
  nativeCurrency: activeChainDef.nativeCurrency,
  rpcUrls: {
    default: { http: [customRpc || publicRpc] },
    public: { http: [publicRpc] },
  },
});

// Kept for backwards-compat with files that import `tempoMainnet`.
export const tempoMainnet = activeChain;

// Build transport chain: Alchemy WS (real-time) → Alchemy HTTP → public RPC fallback
const transportList = [
  ...(alchemyWs ? [webSocket(alchemyWs)] : []),
  ...(customRpc ? [http(customRpc)] : []),
  http(publicRpc),
];

const transport = transportList.length > 1 ? fallback(transportList) : transportList[0];

export const wagmiConfig = getDefaultConfig({
  appName: 'Whale Town',
  projectId: '3939c628561b5c3ecf7cd4559eadfee2',
  chains: [activeChain],
  transports: {
    [activeChain.id]: transport,
  },
});
