import { createWalletClient, http, Hash, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains'; // Just for typing, will use custom chainId

const privateKey = process.env.REWARDS_SIGNER_PRIVATE_KEY as Hash;
const contractAddress = process.env.REWARDS_CLAIMER_CONTRACT as Address;

if (!privateKey) {
  console.warn('REWARDS_SIGNER_PRIVATE_KEY is not set');
}

if (!contractAddress) {
  console.warn('REWARDS_CLAIMER_CONTRACT is not set');
}

const account = privateKey ? privateKeyToAccount(privateKey) : null;

// EIP-712 Domain
const domain = {
  name: 'WhaleTownRewards',
  version: '1',
  chainId: 4217, // Tempo Mainnet
  verifyingContract: contractAddress,
} as const;

// EIP-712 Types
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

export async function signTradingClaim(wallet: Address, amount: bigint, nonce: bigint) {
  if (!account) throw new Error('Signer account not initialized');
  
  return await account.signTypedData({
    domain,
    types,
    primaryType: 'TradingClaim',
    message: {
      wallet,
      amount,
      nonce,
    },
  });
}

export async function signFishingClaim(wallet: Address, amount: bigint, nonce: bigint) {
  if (!account) throw new Error('Signer account not initialized');
  
  return await account.signTypedData({
    domain,
    types,
    primaryType: 'FishingClaim',
    message: {
      wallet,
      amount,
      nonce,
    },
  });
}
