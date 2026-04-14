import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain, http, webSocket, fallback } from 'viem';
// @ts-ignore
import { TEMPO_MAINNET } from '@/contract.js';

const customRpc: string = process.env.RPC_URL || process.env.ALCHEMY_TEMPO_RPC || '';
const alchemyWs: string = process.env.ALCHEMY_TEMPO_WEBSOCKET || '';
const publicRpc: string = TEMPO_MAINNET.rpcUrls.default.http[0];

export const tempoMainnet = defineChain({
  id: TEMPO_MAINNET.id,
  name: TEMPO_MAINNET.name,
  network: TEMPO_MAINNET.network,
  nativeCurrency: TEMPO_MAINNET.nativeCurrency,
  rpcUrls: {
    default: { http: [customRpc || publicRpc] },
    public: { http: [publicRpc] },
  },
});

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
  chains: [tempoMainnet],
  transports: {
    [TEMPO_MAINNET.id]: transport,
  },
});
