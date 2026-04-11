import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';
// @ts-ignore
import { TEMPO_MAINNET } from '@/contract.js';

export const tempoMainnet = defineChain({
  id: TEMPO_MAINNET.id,
  name: TEMPO_MAINNET.name,
  network: TEMPO_MAINNET.network,
  nativeCurrency: TEMPO_MAINNET.nativeCurrency,
  rpcUrls: TEMPO_MAINNET.rpcUrls,
});

export const wagmiConfig = getDefaultConfig({
  appName: 'Whale Town',
  projectId: '3939c628561b5c3ecf7cd4559eadfee2',
  chains: [tempoMainnet],
});
