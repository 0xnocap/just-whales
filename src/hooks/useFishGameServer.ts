import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { pointsAddress, pointsAbi } from '../contract';
import type { FishType } from '../constants/fishGameData';

const TREASURY_WALLET = '0x65D814d1F74b35C96A3D648258922826C36d27e7';

export interface FishInventoryItem {
  gameEventId: string;
  fish: FishType;
  redeemed: boolean;
  prizeTier?: string;
}

export interface FishGameState {
  isNFTOwner?: boolean;
  castsRemaining: number;
  totalCasts: number;
  tackleBoxPurchased: boolean;
  tackleBoxPurchasedAt: string | null;
  inventory: FishInventoryItem[];
  discoveredFishIds: string[];
  unclaimedFishingOP: string;
}

export function useFishGameServer() {
  const { address } = useAccount();
  const [state, setState] = useState<FishGameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [isNotifyingBackend, setIsNotifyingBackend] = useState(false);

  const { writeContract, data: hash, isPending: isPurchasing, error: purchaseError } = useWriteContract();

  const { data: onChainOPBalance } = useReadContract({
    address: pointsAddress,
    abi: pointsAbi,
    functionName: 'balanceOf',
    args: address ? [address] : ['0x0000000000000000000000000000000000000000'],
    query: { enabled: !!address },
  });
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const fetchState = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/fish/state/${address}`);
      if (!res.ok) throw new Error('Failed to fetch game state');
      const data = await res.json();
      setState(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // When tackle box tx is confirmed on-chain, notify backend and hold disabled until state refreshes
  useEffect(() => {
    if (isConfirmed && hash && address) {
      const notifyBackend = async () => {
        setIsNotifyingBackend(true);
        try {
          const res = await fetch('/api/fish/buy-tackle-box', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, txHash: hash })
          });
          if (res.ok) await fetchState();
        } catch (e) {
          console.error('Failed to notify backend of tackle box purchase:', e);
        } finally {
          setIsNotifyingBackend(false);
        }
      };
      notifyBackend();
    }
  }, [isConfirmed, hash, address, fetchState]);

  const cast = async () => {
    if (!address) return { result: 'error', error: 'Wallet not connected' };
    try {
      const res = await fetch('/api/fish/cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cast');
      
      // Update local state optimistically or just refetch later
      if (data.result === 'catch' || data.result === 'no_bite') {
        fetchState();
      }
      return data;
    } catch (err: any) {
      setError(err.message);
      return { result: 'error', error: err.message };
    }
  };

  const sell = async (gameEventId: string) => {
    if (!address) return;
    setSellingId(gameEventId);
    try {
      const res = await fetch('/api/fish/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, gameEventId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sell fish');
      fetchState();
      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSellingId(null);
    }
  };

  const buyTackleBox = async () => {
    if (!address) return;
    writeContract({
      address: pointsAddress,
      abi: pointsAbi,
      functionName: 'transfer',
      args: [TREASURY_WALLET, BigInt(125) * BigInt(10**18)],
    });
  };

  const grantTestResources = async () => {
    if (!address) return;
    await fetch('/api/fish/dev-grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    fetchState();
  };

  return {
    state,
    loading,
    isPurchasing: isPurchasing || isConfirming || isNotifyingBackend,
    error: error || purchaseError?.message,
    sellingId,
    onChainOPBalance: onChainOPBalance as bigint | undefined,
    cast,
    sell,
    buyTackleBox,
    grantTestResources,
    refetch: fetchState
  };
}
