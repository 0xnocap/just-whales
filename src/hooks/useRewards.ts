import { useState, useEffect, useCallback, useRef } from 'react';
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

  const { writeContract, data: hash, isPending: isWritePending, error: claimError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isClaimed } = useWaitForTransactionReceipt({ hash });

  // Sync ref-based guard prevents double-click from firing two sign requests
  // before React re-renders the disabled button.
  const busyRef = useRef(false);
  const [isSigning, setIsSigning] = useState(false);

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

  const clearBusy = useCallback(() => {
    busyRef.current = false;
    setIsSigning(false);
    setPendingClaimType(null);
  }, []);

  useEffect(() => {
    if (isClaimed && address && hash && pendingClaimType) {
      // Confirm on-chain success with the backend
      fetch('/api/economy/confirm-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, type: pendingClaimType, txHash: hash })
      }).then(() => {
        clearBusy();
        fetchRewards();
      }).catch((err) => {
        console.error(err);
        clearBusy();
      });
    }
  }, [isClaimed, hash, address, pendingClaimType, fetchRewards, clearBusy]);

  // Wallet rejection or RPC error from writeContract → release the lock
  useEffect(() => {
    if (claimError) {
      clearBusy();
      resetWrite();
    }
  }, [claimError, clearBusy, resetWrite]);

  const runClaim = async (
    type: 'trading' | 'fishing',
    endpoint: string,
    contractFn: 'claimTradingRewards' | 'claimFishingRewards'
  ) => {
    if (!address) return;
    // Sync guard — blocks double-click even before React re-renders the disabled button
    if (busyRef.current) return;
    busyRef.current = true;
    setIsSigning(true);
    setPendingClaimType(type);
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign claim');
      }
      const { amount, nonce, signature } = await res.json();

      // Keep busy flag set; clearBusy runs on success, cancel, or error.
      writeContract({
        address: rewardsClaimerAddress,
        abi: rewardsClaimerAbi,
        functionName: contractFn,
        args: [BigInt(amount), BigInt(nonce), signature],
      });
    } catch (err: any) {
      setError(err.message);
      clearBusy();
    }
  };

  const claimTradingRewards = () => runClaim('trading', '/api/economy/sign-trading-claim', 'claimTradingRewards');
  const claimFishingRewards = () => runClaim('fishing', '/api/economy/sign-fishing-claim', 'claimFishingRewards');

  return {
    rewards,
    loading,
    error: error || claimError?.message,
    // Button stays disabled + spinner stays up from click → sign → wallet → confirm → DB update
    isClaiming: isSigning || isWritePending || isConfirming,
    isClaimed,
    claimTradingRewards,
    claimFishingRewards,
    refetch: fetchRewards
  };
}
