import type { Address, Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getEnvConfig } from './_env.js';

const types = {
  TradingClaim: [
    { name: 'wallet', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
  FishingClaim: [
    { name: 'wallet', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

function buildContext() {
  const env = getEnvConfig();
  const privateKey = env.requireSignerKey();
  const verifyingContract = env.requireRewardsClaimer();
  const account = privateKeyToAccount(privateKey as Hash);
  const domain = {
    name: 'WhaleTownRewards',
    version: '1',
    chainId: env.chainId,
    verifyingContract,
  } as const;
  return { account, domain };
}

export async function signTradingClaim(wallet: Address, amount: bigint, nonce: bigint) {
  const { account, domain } = buildContext();
  return account.signTypedData({
    domain,
    types,
    primaryType: 'TradingClaim',
    message: { wallet, amount, nonce },
  });
}

export async function signFishingClaim(wallet: Address, amount: bigint, nonce: bigint) {
  const { account, domain } = buildContext();
  return account.signTypedData({
    domain,
    types,
    primaryType: 'FishingClaim',
    message: { wallet, amount, nonce },
  });
}
