import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { rewardsClaimerAddress, rewardsClaimerAbi } from '../contract';

export interface RewardsSummary {
  trading: {
    totalPurchases: number;
    unclaimedPurchases: number;
    unclaimedOP: string;
    unclaimedFormatted: string;
  };
  fishing: {
    unclaimedOP: string;
    unclaimedFormatted: string;
  };
  nonces: {
    trading: number;
    fishing: number;
  };
}

export function useRewards() {
  const { address } = useAccount();
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: hash, isPending: isClaiming, error: claimError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isClaimed } = useWaitForTransactionReceipt({ hash });

  const fetchRewards = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/economy/rewards/${address}`);
      if (!res.ok) throw new Error('Failed to fetch rewards');
      const data = await res.json();
      setRewards(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchRewards();
    const interval = setInterval(fetchRewards, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchRewards]);

  // Track which claim type is in progress so we can confirm the right one
  const [pendingClaimType, setPendingClaimType] = useState<'trading' | 'fishing' | null>(null);

  useEffect(() => {
    if (isClaimed && address && hash && pendingClaimType) {
      // Confirm on-chain success with the backend
      fetch('/api/economy/confirm-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, type: pendingClaimType, txHash: hash })
      }).then(() => {
        setPendingClaimType(null);
        fetchRewards();
      }).catch(console.error);
    }
  }, [isClaimed, hash, address, pendingClaimType, fetchRewards]);

  const claimTradingRewards = async () => {
    if (!address) return;
    setPendingClaimType('trading');
    try {
      const res = await fetch('/api/economy/sign-trading-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign claim');
      }
      const { amount, nonce, signature } = await res.json();

      writeContract({
        address: rewardsClaimerAddress,
        abi: rewardsClaimerAbi,
        functionName: 'claimTradingRewards',
        args: [BigInt(amount), BigInt(nonce), signature],
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const claimFishingRewards = async () => {
    if (!address) return;
    setPendingClaimType('fishing');
    try {
      const res = await fetch('/api/economy/sign-fishing-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign claim');
      }
      const { amount, nonce, signature } = await res.json();

      writeContract({
        address: rewardsClaimerAddress,
        abi: rewardsClaimerAbi,
        functionName: 'claimFishingRewards',
        args: [BigInt(amount), BigInt(nonce), signature],
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return {
    rewards,
    loading,
    error: error || claimError?.message,
    isClaiming: isClaiming || isConfirming,
    isClaimed,
    claimTradingRewards,
    claimFishingRewards,
    refetch: fetchRewards
  };
}
