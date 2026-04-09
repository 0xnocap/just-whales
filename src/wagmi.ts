import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';
// @ts-ignore
import { TEMPO_TESTNET } from '@/contract.js';

export const tempoTestnet = defineChain({
  id: TEMPO_TESTNET.id,
  name: TEMPO_TESTNET.name,
  network: TEMPO_TESTNET.network,
  nativeCurrency: TEMPO_TESTNET.nativeCurrency,
  rpcUrls: TEMPO_TESTNET.rpcUrls,
});

export const wagmiConfig = getDefaultConfig({
  appName: 'Whale Town',
  projectId: '3939c628561b5c3ecf7cd4559eadfee2',
  chains: [tempoTestnet],
});
