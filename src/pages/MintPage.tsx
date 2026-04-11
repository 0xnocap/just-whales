import React, { useState, useEffect } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import {
  contractAddress, contractAbi,
  readTotalSupply, readMaxSupply, readMintPrice,
  readIsPublicMintActive, readMaxPerAddress,
  readTokenURI, decodeTokenURI,
} from '../contract';
import type { TokenMetadata } from '../contract';

interface MintPageProps {
  onMintSuccess: (t: TokenMetadata & { id: number }) => void;
}

const MintPage: React.FC<MintPageProps> = ({ onMintSuccess }) => {
  const { address: walletAddress, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: txHash, isPending: isTxPending, error: txError, reset: resetTx } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const [totalSupply, setTotalSupply] = useState(0);
  const [maxSupply, setMaxSupply] = useState(3333);
  const [mintPrice, setMintPrice] = useState(0n);
  const [isActive, setIsActive] = useState(false);
  const [maxPerAddr, setMaxPerAddr] = useState(20);
  const [mintCount, setMintCount] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const [supply, max, price, active, maxPer] = await Promise.all([
          readTotalSupply(), readMaxSupply(), readMintPrice(),
          readIsPublicMintActive(), readMaxPerAddress(),
        ]);
        setTotalSupply(Number(supply));
        setMaxSupply(Number(max));
        setMintPrice(price);
        setIsActive(active);
        setMaxPerAddr(Number(maxPer));
      } catch (e) { console.error('Failed to load contract state', e); }
    }
    load();
  }, []);

  useEffect(() => {
    if (isSuccess) {
      readTotalSupply().then(async (s) => {
        const newSupply = Number(s);
        setTotalSupply(newSupply);
        try {
          const lastId = newSupply - 1;
          const uri = await readTokenURI(BigInt(lastId));
          onMintSuccess({ ...decodeTokenURI(uri), id: lastId });
        } catch (e) { console.error('Failed to fetch minted token', e); }
      });
    }
  }, [isSuccess, onMintSuccess]);

  const handleMint = () => {
    resetTx();
    writeContract({
      address: contractAddress,
      abi: contractAbi,
      functionName: 'mint',
      args: [BigInt(mintCount), []],
      value: mintPrice * BigInt(mintCount),
    } as any);
  };

  const supplyPct = maxSupply > 0 ? (totalSupply / maxSupply) * 100 : 0;
  const isBusy = isTxPending || isConfirming;
  const statusLabel = isSuccess ? 'MINTED!' : txError ? 'TRY AGAIN' : isTxPending ? 'CONFIRM IN WALLET...' : isConfirming ? 'MINTING...' : `MINT ${mintCount}`;

  return (
    <div
      className="w-full border border-white/10 bg-white/5 backdrop-blur-xl"
      style={{ padding: 'clamp(1.25rem, 2.5vw, 2rem)', borderRadius: 'clamp(1rem, 1.5vw, 1.5rem)' }}
    >
      <div className="flex justify-between items-center" style={{ marginBottom: 'clamp(1rem, 2vh, 1.5rem)' }}>
        <h2 className="font-bold text-dream-white font-sans tracking-tight uppercase" style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.1rem)' }}>PUBLIC MINT</h2>
        <div className="bg-dream-cyan/10 border border-dream-cyan/30 px-3 py-1 rounded-full">
          <span className="font-mono text-dream-cyan font-bold" style={{ fontSize: 'clamp(10px, 0.8vw, 12px)' }}>
            {isActive ? 'LIVE' : 'INACTIVE'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <div className="font-mono text-white/40 uppercase tracking-[0.15em] text-[10px] mb-1">Price</div>
          <div className="font-bold text-white text-lg">FREE</div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <div className="font-mono text-white/40 uppercase tracking-[0.15em] text-[10px] mb-1">Supply</div>
          <div className="font-bold text-white text-lg">{totalSupply} / {maxSupply}</div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="font-mono text-white/40 uppercase tracking-[0.15em] text-[10px]">Progress</span>
          <span className="font-mono text-dream-cyan font-bold text-[10px]">{supplyPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div className="h-full bg-dream-cyan transition-all duration-1000" style={{ width: `${supplyPct}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between bg-[#0a0a0c] rounded-xl p-2 border border-white/10">
          <button
            onClick={() => setMintCount(Math.max(1, mintCount - 1))}
            disabled={isBusy || mintCount <= 1}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 text-white disabled:opacity-20 transition-colors"
          >
            <Minus size={18} />
          </button>
          <span className="font-mono font-black text-xl text-white w-12 text-center">{mintCount}</span>
          <button
            onClick={() => setMintCount(Math.min(maxPerAddr, mintCount + 1))}
            disabled={isBusy || mintCount >= maxPerAddr}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 text-white disabled:opacity-20 transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>

        {!isConnected ? (
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        ) : (
          <button
            onClick={handleMint}
            disabled={isBusy || !isActive || totalSupply >= maxSupply}
            className={`w-full font-black font-mono tracking-[0.2em] transition-all py-4 rounded-xl shadow-lg
              ${isSuccess 
                ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                : 'bg-dream-cyan text-[#0a0a0c] hover:scale-[1.02] active:scale-[0.98] shadow-dream-cyan/20 disabled:opacity-20 disabled:scale-100'
              }`}
          >
            {statusLabel}
          </button>
        )}
      </div>

      {txError && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
          <p className="font-mono text-red-400 text-[10px] uppercase tracking-wider">
            {(txError as any).shortMessage || 'MINT FAILED'}
          </p>
        </div>
      )}
    </div>
  );
};

export default MintPage;
