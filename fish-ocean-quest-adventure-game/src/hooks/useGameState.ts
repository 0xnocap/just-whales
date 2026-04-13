import { useState, useEffect } from 'react';
import { FISH_LIST, FREE_DAILY_ATTEMPTS, TACKLE_BOX_ATTEMPTS, TACKLE_BOX_COST } from '../constants/gameData';

export function useGameState() {
  const [attempts, setAttempts] = useState(0);
  const [coins, setCoins] = useState(0);
  const [inventory, setInventory] = useState<any[]>([]);
  const [discoveredFishIds, setDiscoveredFishIds] = useState<string[]>([]);
  const [lastReset, setLastReset] = useState<string>('');
  const [hasPurchasedTackleBox, setHasPurchasedTackleBox] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Load state from local storage
  useEffect(() => {
    const savedState = localStorage.getItem('ocean_quest_state');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      setCoins(parsed.coins || 0);
      setInventory(parsed.inventory || []);
      setDiscoveredFishIds(parsed.discoveredFishIds || []);
      setLastReset(parsed.lastReset || '');
      setHasPurchasedTackleBox(parsed.hasPurchasedTackleBox || false);
      setAttempts(parsed.attempts || 0);
    }
    
    // Check for daily reset
    const today = new Date().toISOString().split('T')[0];
    const lastSavedDate = localStorage.getItem('ocean_quest_last_date');
    
    if (lastSavedDate !== today) {
      setAttempts(FREE_DAILY_ATTEMPTS);
      setHasPurchasedTackleBox(false);
      localStorage.setItem('ocean_quest_last_date', today);
    }
  }, []);

  // Save state to local storage
  useEffect(() => {
    const state = {
      coins,
      inventory,
      discoveredFishIds,
      lastReset,
      hasPurchasedTackleBox,
      attempts
    };
    localStorage.setItem('ocean_quest_state', JSON.stringify(state));
  }, [coins, inventory, discoveredFishIds, lastReset, hasPurchasedTackleBox, attempts]);

  const connectWallet = async () => {
    if (window.ethereum) {
      setIsConnecting(true);
      setWalletError(null);
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
      } catch (err: any) {
        console.error("Wallet connection failed", err);
        setWalletError(err.message || "Connection failed");
      } finally {
        setIsConnecting(false);
      }
    } else {
      setWalletError("MetaMask not found");
      alert("Please install MetaMask or another EVM wallet!");
    }
  };

  const useAttempt = () => {
    if (attempts > 0) {
      setAttempts(prev => prev - 1);
      return true;
    }
    return false;
  };

  const addFish = (fish: any) => {
    setInventory(prev => [...prev, fish]);
    setDiscoveredFishIds(prev => {
      if (prev.includes(fish.id)) return prev;
      return [...prev, fish.id];
    });
  };

  const sellFish = (fishId: string) => {
    const fish = FISH_LIST.find(f => f.id === fishId);
    if (fish) {
      setCoins(prev => prev + fish.value);
      setInventory(prev => {
        const index = prev.findIndex(f => f.id === fishId);
        if (index > -1) {
          const newInv = [...prev];
          newInv.splice(index, 1);
          return newInv;
        }
        return prev;
      });
    }
  };

  const buyTackleBox = () => {
    if (coins >= TACKLE_BOX_COST && !hasPurchasedTackleBox) {
      setCoins(prev => prev - TACKLE_BOX_COST);
      setAttempts(prev => prev + TACKLE_BOX_ATTEMPTS);
      setHasPurchasedTackleBox(true);
      return true;
    }
    return false;
  };

  const grantTestResources = () => {
    setCoins(999999);
    setAttempts(999);
  };

  return {
    attempts,
    coins,
    inventory,
    discoveredFishIds,
    walletAddress,
    isConnecting,
    walletError,
    hasPurchasedTackleBox,
    connectWallet,
    useAttempt,
    addFish,
    sellFish,
    buyTackleBox,
    grantTestResources
  };
}
