import type { Address } from 'viem';

const isProd = process.env.ENVIRONMENT === 'production';

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function pick(prodKey: string, testKey: string, fallback?: string): string | undefined {
  const value = isProd ? process.env[prodKey] : process.env[testKey];
  return value ?? fallback;
}

export function getEnvConfig() {
  const rpcUrl = pick('RPC_URL', 'TEST_RPC_URL', isProd ? 'https://rpc.tempo.xyz' : 'https://rpc.moderato.tempo.xyz')!;
  const chainId = Number(pick('CHAIN_ID', 'TEST_CHAIN_ID', isProd ? '4217' : '42431'));
  const rewardsClaimer = pick('REWARDS_CLAIMER_CONTRACT', 'TEST_REWARDS_CLAIMER_CONTRACT') as Address | undefined;
  const pointsContract = pick('POINTS_CONTRACT', 'TEST_POINTS_CONTRACT') as Address | undefined;
  const treasuryWallet = pick('TREASURY_WALLET', 'TEST_TREASURY_WALLET') as Address | undefined;
  const signerPrivateKey = process.env.REWARDS_SIGNER_PRIVATE_KEY as `0x${string}` | undefined;

  return {
    isProd,
    rpcUrl,
    chainId,
    rewardsClaimer,
    pointsContract,
    treasuryWallet,
    signerPrivateKey,
    requireRewardsClaimer: () => required(rewardsClaimer, isProd ? 'REWARDS_CLAIMER_CONTRACT' : 'TEST_REWARDS_CLAIMER_CONTRACT'),
    requireTreasuryWallet: () => required(treasuryWallet, isProd ? 'TREASURY_WALLET' : 'TEST_TREASURY_WALLET'),
    requirePointsContract: () => required(pointsContract, isProd ? 'POINTS_CONTRACT' : 'TEST_POINTS_CONTRACT'),
    requireSignerKey: () => required(signerPrivateKey, 'REWARDS_SIGNER_PRIVATE_KEY'),
  };
}
