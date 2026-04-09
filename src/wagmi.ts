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
  projectId: 'whale-town-local', // WalletConnect project ID - works for dev
  chains: [tempoTestnet],
});
