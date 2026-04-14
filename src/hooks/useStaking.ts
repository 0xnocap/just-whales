import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, type Abi, parseEther } from 'viem';
import {
  contractAddress,
  contractAbi as _contractAbi,
  pointsAddress,
  pointsAbi as _pointsAbi,
  stakingAddress,
  stakingAbi as _stakingAbi,
  readIsApprovedForAll,
  scanOwnedTokens,
} from '../contract';
import { api } from '../lib/api';

// --- Local Metadata Cache ---
interface TokenCache {
  id: number;
  attributes: Array<{ trait_type: string; value: string }>;
}
let metadataCache: TokenCache[] | null = null;
const fetchMetadataCache = async () => {
  if (metadataCache) return metadataCache;
  try {
    const res = await fetch('/metadata-cache.json');
    const data = await res.json();
    metadataCache = data;
    return data;
  } catch (e) {
    console.error("Failed to load metadata cache:", e);
    return [];
  }
};

const contractAbi = _contractAbi as Abi;
const pointsAbi = _pointsAbi as Abi;
const stakingAbi = _stakingAbi as Abi;

const isTestnet = Number(process.env.CHAIN_ID) === 42431;

export function usePointsBalance() {
  const { address } = useAccount();
  const { data, refetch, isLoading } = useReadContract({
    address: pointsAddress,
    abi: pointsAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!pointsAddress, refetchInterval: 15_000 },
  });
  const raw = (data as bigint | undefined) ?? 0n;
  const formatted = useMemo(() => {
    const n = Number(formatUnits(raw, 18));
    return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  }, [raw]);
  return { raw, formatted, refetch, isLoading };
}

export function useUnstakedTokens(stakedIds: number[]) {
  const { address } = useAccount();
  const [owned, setOwned] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!address) { setOwned([]); return; }
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        if (isTestnet) {
          const ids = await scanOwnedTokens(address);
          if (!cancelled) setOwned(ids);
        } else {
          const data = await api.profile(address);
          if (!cancelled) setOwned((data?.ownedTokenIds || []) as number[]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [address, refreshKey]);

  const stakedSet = useMemo(() => new Set(stakedIds), [stakedIds]);
  const unstaked = useMemo(() => owned.filter((id) => !stakedSet.has(id)), [owned, stakedSet]);
  return { unstaked, ownedCount: owned.length, loading, refetch };
}

export function useStakingReads() {
  const { address } = useAccount();
  const { data, refetch, isLoading } = useReadContracts({
    contracts: address ? [
      { address: stakingAddress, abi: stakingAbi, functionName: 'stakedTokensOf', args: [address] },
      { address: stakingAddress, abi: stakingAbi, functionName: 'rewardsOf', args: [address] },
      { address: stakingAddress, abi: stakingAbi, functionName: 'paused' },
    ] : [],
    query: { enabled: !!address && !!stakingAddress, refetchInterval: 15_000 },
  });

  const stakedIds = useMemo(() => {
    const ids = (data?.[0]?.result as bigint[] | undefined) ?? [];
    return ids.map((n) => Number(n));
  }, [data]);

  const rewardsRaw = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const rewardsFormatted = useMemo(() => {
    const n = Number(formatUnits(rewardsRaw, 18));
    return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  }, [rewardsRaw]);

  const paused = (data?.[2]?.result as boolean | undefined) ?? false;

  return { stakedIds, rewardsRaw, rewardsFormatted, paused, refetch, isLoading };
}

// --- NEW LOCAL RATE CALCULATION ---
const baseRatesMap: Record<string, number> = {
  'Shark': 10, 'Sharks': 10, 'Whale': 20, 'Whales': 20, 'SeaLion': 5, 'SeaLions': 5,
};

function calculateRateFromAttrs(attrs: Array<{ trait_type: string; value: string }>): number {
  let baseRate = 0;
  let bonus = 0;

  const animalType = attrs.find(a => a.trait_type === 'Animal Type')?.value || '';
  const base = attrs.find(a => a.trait_type === 'Base')?.value;
  const clothing = attrs.find(a => a.trait_type === 'Clothing')?.value;
  const bodyAcc = attrs.find(a => a.trait_type === 'BodyAccessories')?.value;

  baseRate = baseRatesMap[animalType] || 0;

  if (base === 'Golden') baseRate = 35;
  else if (base === 'GreatWhite') baseRate = 20;
  else if (base === 'White-Spotted') baseRate = 20;

  if (clothing === 'GoldChain') bonus += 10;
  if (clothing === 'PirateCaptainCoat') bonus += 15;
  if (bodyAcc === 'DiamondWatch') bonus += 30;
  if (bodyAcc === 'GoldWatch') bonus += 25;

  return baseRate + bonus;
}

/**
 * Reads per-token rates from the local metadata cache.
 * NO RPC calls are made here.
 */
export function useTokenRates(tokenIds: number[]) {
  const [rates, setRates] = useState<Record<number, bigint>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchMetadataCache().then(cache => {
      const newRates: Record<number, bigint> = {};
      const cacheMap = new Map(cache.map(item => [item.id, item.attributes]));
      
      for (const id of tokenIds) {
        const attrs = cacheMap.get(id);
        if (attrs) {
          const rate = calculateRateFromAttrs(attrs);
          newRates[id] = parseEther(rate.toString());
        } else {
          newRates[id] = 0n; // Fallback if token not in cache
        }
      }
      setRates(newRates);
      setLoading(false);
    });
  }, [tokenIds.join(',')]);

  return { rates, loading };
}


const _imageCache = new Map<number, { image_data: string; name?: string }>();
export function useTokenImages(tokenIds: number[]) {
  const [images, setImages] = useState<Record<number, { image_data: string; name?: string }>>({});
  const [loading, setLoading] = useState(true);
  const key = tokenIds.join(',');

  useEffect(() => {
    if (tokenIds.length === 0) {
      setImages({});
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;

    const seeded: Record<number, { image_data: string; name?: string }> = {};
    const missing: number[] = [];
    for (const id of tokenIds) {
      const hit = _imageCache.get(id);
      if (hit) seeded[id] = hit; else missing.push(id);
    }
    if (Object.keys(seeded).length) setImages((prev) => ({ ...prev, ...seeded }));
    
    if (missing.length === 0) {
      setLoading(false);
      return;
    }

    const load = async () => {
      let metadataMap: Record<number, any> = {};
      try { 
        metadataMap = await api.metadata(missing); 
      } catch { 
        // Fallback for testnet or if API fails
        const onchain = await Promise.all(missing.map(async (id) => {
            try {
              const res = await fetch(`/whale-town-metadata/${id}.json`);
              const meta = await res.json();
              return { id, meta };
            } catch { return { id, meta: null as any }; }
        }));
        onchain.forEach(({ id, meta }) => {
          if (meta) metadataMap[id] = meta;
        });
      }

      if (cancelled) return;
      const next: Record<number, { image_data: string; name?: string }> = {};
      for (const id of missing) {
        const m = metadataMap[id];
        const image = m?.image || m?.image_data;
        if (image) {
          const entry = { image_data: image, name: m.name };
          _imageCache.set(id, entry);
          next[id] = entry;
        }
      }
      if (Object.keys(next).length) {
        setImages((prev) => ({ ...prev, ...next }));
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [key]);

  return { images, loading };
}

export function sumDailyRate(rates: Record<number, bigint>, tokenIds: number[]): number {
  let sum = 0n;
  for (const id of tokenIds) sum += rates[id] ?? 0n;
  const n = Number(formatUnits(sum, 18));
  return Number.isFinite(n) ? n : 0;
}

type TxState = 'idle' | 'approving' | 'staking' | 'unstaking' | 'claiming';

export function useStakingActions(onSuccess?: () => void) {
  const { address } = useAccount();
  const { writeContractAsync: _writeContractAsync } = useWriteContract();
  const writeContractAsync = _writeContractAsync as any;
  const [state, setState] = useState<TxState>('idle');
  const [error, setError] = useState<string>('');
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: pendingHash });

  useEffect(() => {
    if (confirmed && pendingHash) {
      setState('idle');
      setPendingHash(undefined);
      onSuccess?.();
    }
  }, [confirmed, pendingHash, onSuccess]);

  const stake = useCallback(async (tokenIds: number[]) => {
    if (!address || tokenIds.length === 0) return;
    setError('');
    try {
      const approved = await readIsApprovedForAll(address, stakingAddress);
      if (!approved) {
        setState('approving');
        const approveHash = await writeContractAsync({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'setApprovalForAll',
          args: [stakingAddress, true],
        });
        setPendingHash(approveHash);
        await new Promise<void>((resolve) => {
          const poll = setInterval(() => {
            readIsApprovedForAll(address, stakingAddress).then((ok) => {
              if (ok) { clearInterval(poll); resolve(); }
            });
          }, 2000);
        });
      }
      setState('staking');
      const hash = await writeContractAsync({
        address: stakingAddress,
        abi: stakingAbi,
        functionName: 'stake',
        args: [tokenIds.map((id) => BigInt(id))],
      });
      setPendingHash(hash);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'stake failed');
      setState('idle');
    }
  }, [address, writeContractAsync]);

  const unstake = useCallback(async (tokenIds: number[]) => {
    if (!address || tokenIds.length === 0) return;
    setError('');
    try {
      setState('unstaking');
      const hash = await writeContractAsync({
        address: stakingAddress,
        abi: stakingAbi,
        functionName: 'unstake',
        args: [tokenIds.map((id) => BigInt(id))],
      });
      setPendingHash(hash);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'unstake failed');
      setState('idle');
    }
  }, [address, writeContractAsync]);

  const claim = useCallback(async () => {
    if (!address) return;
    setError('');
    try {
      setState('claiming');
      const hash = await writeContractAsync({
        address: stakingAddress,
        abi: stakingAbi,
        functionName: 'claim',
      });
      setPendingHash(hash);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'claim failed');
      setState('idle');
    }
  }, [address, writeContractAsync]);

  return { stake, unstake, claim, state, error };
}
