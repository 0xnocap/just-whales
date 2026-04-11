import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, Loader2, Sparkles, ArrowUpRight, ChevronDown } from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { formatUnits, parseUnits } from 'viem';
import {
  contractAddress, contractAbi,
  marketplaceAddress, marketplaceAbi,
  pathUSDAddress, pathUSDAbi,
  readPathUSDAllowance, readIsApprovedForAll,
  waitForTransaction,
} from '../contract';
import type { ModalTokenProps } from '../types';
import { truncateAddress, timeUntil } from '../utils/format';
import { api } from '../lib/api';
import BlockiesAvatar from './BlockiesAvatar';
import CopyButton from './CopyButton';

interface TokenModalProps {
  token: ModalTokenProps | null;
  onClose: () => void;
}

const TokenModal: React.FC<TokenModalProps> = ({ token, onClose }) => {
  const { isConnected, address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const navigate = useNavigate();
  
  const [listPrice, setListPrice] = useState('');
  const [expirationDays, setExpirationDays] = useState<number>(7);
  const [customExpiration, setCustomExpiration] = useState('');
  const [status, setStatus] = useState<'idle' | 'approving' | 'confirming' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [openSections, setOpenSections] = useState({ traits: true, details: true, activity: false });
  const toggleSection = (key: 'traits' | 'details' | 'activity') =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!token) return;
    setLoadingHistory(true);
    api.tokenHistory(token.id)
      .then(data => { setHistory(data); setLoadingHistory(false); })
      .catch(() => setLoadingHistory(false));
  }, [token?.id]);

  if (!token) return null;
  const animalType = token.attributes.find(a => a.trait_type === 'Animal Type')?.value || '';
  const traits = token.attributes.filter(a => a.trait_type !== 'Animal Type' && a.value !== 'None');

  const getExpirationTimestamp = (): bigint => {
    if (expirationDays === 0) return 0n;
    if (expirationDays === -1 && customExpiration) {
      return BigInt(Math.floor(new Date(customExpiration).getTime() / 1000));
    }
    return BigInt(Math.floor(Date.now() / 1000) + expirationDays * 86400);
  };

  const handleBuy = async () => {
    if (!isConnected || !address || !token.listingData) return;
    setStatus('approving');
    setErrorMsg('');
    try {
      const price = token.listingData.price;
      const allowance = await readPathUSDAllowance(address, marketplaceAddress);
      if (allowance < price) {
        const approveHash = await writeContractAsync({
          address: pathUSDAddress,
          abi: pathUSDAbi,
          functionName: 'approve',
          args: [marketplaceAddress, price],
        } as any);
        await waitForTransaction(approveHash);
      }
      setStatus('confirming');
      const hash = await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'buy',
        args: [token.listingData.id],
      } as any);
      await waitForTransaction(hash);
      setStatus('success');
      if (token.onBuySuccess) token.onBuySuccess();
      setTimeout(onClose, 2000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.shortMessage || err.message || 'Transaction failed');
      setStatus('idle');
    }
  };

  const handleList = async () => {
    if (!isConnected || !address || !listPrice || Number(listPrice) <= 0) return;
    setStatus('approving');
    setErrorMsg('');
    try {
      const isApproved = await readIsApprovedForAll(address, marketplaceAddress);
      if (!isApproved) {
        const approveHash = await writeContractAsync({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'setApprovalForAll',
          args: [marketplaceAddress, true],
        } as any);
        await waitForTransaction(approveHash);
      }
      setStatus('confirming');
      const expiresAt = getExpirationTimestamp();
      const hash = await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'list',
        args: [contractAddress, BigInt(token.id), parseUnits(listPrice, 6), expiresAt],
      } as any);
      await waitForTransaction(hash);
      setStatus('success');
      setTimeout(onClose, 2000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.shortMessage || err.message || 'Transaction failed');
      setStatus('idle');
    }
  };

  const handleCancel = async () => {
    if (!isConnected || !token.listingData) return;
    setStatus('confirming');
    setErrorMsg('');
    try {
      const hash = await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'cancel',
        args: [token.listingData.id],
      } as any);
      await waitForTransaction(hash);
      setStatus('success');
      setTimeout(onClose, 2000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.shortMessage || err.message || 'Transaction failed');
      setStatus('idle');
    }
  };

  const animalColors: Record<string, string> = {
    Sharks: '#22d3ee', Shark: '#22d3ee',
    Whales: '#c084fc', Whale: '#c084fc',
    SeaLions: '#a5f3fc', SeaLion: '#a5f3fc',
  };
  const tagColor = animalColors[animalType] || '#22d3ee';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative z-10 bg-[#18181b] border border-white/[0.08] w-full md:w-[64rem] flex flex-col md:flex-row shadow-2xl shadow-black/50 overflow-y-auto md:overflow-hidden"
        style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: '1.25rem' }}
      >
        {/* Close Button - positioned absolutely over the whole modal, but to the right so it is outside the image on desktop */}
        <button onClick={onClose} className="absolute z-[200] flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full text-white/50 hover:text-white transition-all cursor-pointer" style={{ top: '1rem', right: '1rem', width: '2.5rem', height: '2.5rem', backdropFilter: 'blur(8px)' }}>
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Image */}
        <div className="w-full md:w-[28rem] lg:w-[32rem] flex-shrink-0 relative p-6 md:p-8 flex items-center justify-center bg-transparent">
          <div className="w-full relative aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/5">
            <img src={token.image_data} alt={token.name} className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
            <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md rounded-lg px-2.5 py-1">
              <span className="font-mono text-white/90 text-xs font-bold tracking-wider">#{token.id}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Content — pinned top (actions) + scrollable bottom (traits/details/activity) */}
        <div className="flex-1 flex flex-col min-h-0 bg-transparent">

          {/* --- TOP: always fully visible, never scrolls --- */}
          <div className="flex flex-col gap-4 pt-4 md:pt-8 px-6 md:pr-8 md:pl-2 pb-4">

            {/* Name & type */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded-full" style={{ color: tagColor, background: `${tagColor}15`, border: `1px solid ${tagColor}30` }}>
                  {animalType}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">{token.name}</h2>
            </div>

            {/* Owner */}
            {token.ownerAddress && (
              <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5">
                <BlockiesAvatar address={token.ownerAddress} size={20} />
                <div className="flex flex-col flex-1">
                  <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.15em]">Owner</span>
                  <button onClick={() => { onClose(); navigate(`/profile/${token.ownerAddress}`); }} className="text-[13px] font-mono text-dream-cyan hover:text-white transition-colors cursor-pointer text-left">
                    {truncateAddress(token.ownerAddress)}
                  </button>
                </div>
                <CopyButton text={token.ownerAddress} />
              </div>
            )}

            {/* Price / Actions — always fully rendered, no scroll clipping */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
              {status === 'success' ? (
                <div className="bg-emerald-500/10 p-4 text-center">
                  <span className="font-mono text-emerald-400 text-xs font-bold tracking-[0.2em]">✓ SUCCESS</span>
                </div>
              ) : status === 'approving' || status === 'confirming' ? (
                <div className="bg-dream-cyan/5 p-4 flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin w-4 h-4 text-dream-cyan" />
                  <span className="font-mono text-dream-cyan text-xs font-bold tracking-[0.2em]">
                    {status === 'approving' ? 'APPROVE IN WALLET...' : 'CONFIRMING...'}
                  </span>
                </div>
              ) : (
                <>
                  {token.isListing ? (
                    <div className="p-4">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.15em]">Current Price</span>
                        {token.listingData.expiresAt > 0n && (
                          <span className="text-[10px] font-mono text-white/30 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeUntil(Number(token.listingData.expiresAt))}
                          </span>
                        )}
                      </div>
                      <div className="text-3xl font-bold text-white mb-4">
                        ${Number(formatUnits(token.listingData.price, 6)).toFixed(2)}
                        <span className="text-sm text-white/30 ml-1.5 font-normal">USD</span>
                      </div>
                      {token.isSeller ? (
                        <button onClick={handleCancel} className="w-full bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-bold font-mono text-xs py-3 rounded-xl tracking-[0.15em] transition-all cursor-pointer">
                          CANCEL LISTING
                        </button>
                      ) : (
                        <button onClick={handleBuy} disabled={!isConnected} className="w-full bg-dream-cyan hover:bg-dream-cyan/90 text-[#0a0a0c] font-bold font-mono text-sm py-3.5 rounded-xl tracking-[0.1em] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-dream-cyan/20">
                          {isConnected ? 'BUY NOW' : 'CONNECT WALLET TO BUY'}
                        </button>
                      )}
                    </div>
                  ) : token.isOwner ? (
                    <div className="p-4">
                      <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.15em] block mb-3">List for Sale</span>
                      <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 font-mono text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={listPrice}
                            onChange={e => setListPrice(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-7 pr-3 py-2.5 bg-white/[0.03] border border-white/10 focus:border-dream-cyan/50 rounded-lg text-white font-mono text-sm outline-none transition-colors"
                          />
                        </div>
                      </div>
                      <div className="mb-4">
                        <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.15em] block mb-2">
                          <Clock className="w-3 h-3 inline mr-1" />Expiration
                        </span>
                        <div className="flex gap-1.5 flex-wrap">
                          {[
                            { label: '1D', value: 1 },
                            { label: '3D', value: 3 },
                            { label: '7D', value: 7 },
                            { label: '30D', value: 30 },
                            { label: '∞', value: 0 },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setExpirationDays(opt.value)}
                              className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer ${
                                expirationDays === opt.value
                                  ? 'bg-dream-cyan/20 text-dream-cyan border border-dream-cyan/30'
                                  : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:border-white/20'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={handleList}
                        disabled={!isConnected || !listPrice || Number(listPrice) <= 0}
                        className="w-full bg-dream-purple hover:bg-dream-purple/80 text-white font-bold font-mono text-xs py-3 rounded-xl tracking-[0.15em] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        COMPLETE LISTING
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <span className="font-mono text-white/20 text-[11px] tracking-[0.15em]">NOT LISTED FOR SALE</span>
                    </div>
                  )}
                </>
              )}
              {errorMsg && (
                <div className="px-4 pb-3">
                  <p className="font-mono text-red-400/70 text-[10px] text-center tracking-wider">{errorMsg}</p>
                </div>
              )}
            </div>
          </div>

          {/* --- BOTTOM: accordion sections in scroll zone --- */}
          <div className="flex-1 overflow-visible md:overflow-y-auto flex flex-col px-6 md:pr-8 md:pl-2 pb-8 divide-y divide-white/[0.04]">

            {/* Traits accordion */}
            {traits.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('traits')}
                  className="w-full flex items-center justify-between py-3 text-left cursor-pointer group"
                >
                  <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Traits</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/25 transition-transform duration-200 ${openSections.traits ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {openSections.traits && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-2 pb-4">
                        {traits.map(attr => (
                          <div key={attr.trait_type} className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 hover:border-dream-cyan/20 transition-colors">
                            <div className="text-[9px] font-mono text-dream-cyan/60 uppercase tracking-[0.15em] mb-0.5">{attr.trait_type}</div>
                            <div className="text-[13px] text-white font-medium">{attr.value}</div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Details accordion */}
            <div>
              <button
                onClick={() => toggleSection('details')}
                className="w-full flex items-center justify-between py-3 text-left cursor-pointer group"
              >
                <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Details</span>
                <ChevronDown className={`w-3.5 h-3.5 text-white/25 transition-transform duration-200 ${openSections.details ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {openSections.details && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg divide-y divide-white/[0.04] mb-4">
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-[11px] text-white/40 font-mono">Contract</span>
                        <span className="text-[11px] text-dream-cyan font-mono flex items-center gap-1">
                          {truncateAddress(contractAddress)} <CopyButton text={contractAddress} />
                        </span>
                      </div>
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-[11px] text-white/40 font-mono">Token ID</span>
                        <span className="text-[11px] text-white font-mono">{token.id}</span>
                      </div>
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-[11px] text-white/40 font-mono">Standard</span>
                        <span className="text-[11px] text-white font-mono">ERC-721A</span>
                      </div>
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-[11px] text-white/40 font-mono">Chain</span>
                        <span className="text-[11px] text-white font-mono">Tempo</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Activity accordion */}
            <div>
              <button
                onClick={() => toggleSection('activity')}
                className="w-full flex items-center justify-between py-3 text-left cursor-pointer group"
              >
                <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Activity</span>
                <ChevronDown className={`w-3.5 h-3.5 text-white/25 transition-transform duration-200 ${openSections.activity ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {openSections.activity && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="pb-4">
                      {loadingHistory ? (
                        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-white/20 w-4 h-4" /></div>
                      ) : history.length === 0 ? (
                        <div className="text-center py-4 text-white/15 font-mono text-[11px]">No activity</div>
                      ) : (
                        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg divide-y divide-white/[0.04]">
                          {history.map((h, i) => {
                            const isMint = h.from === '0x0000000000000000000000000000000000000000';
                            return (
                              <div key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                                <div className="flex items-center gap-2">
                                  {isMint ? (
                                    <Sparkles className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                  ) : (
                                    <ArrowUpRight className="w-3 h-3 text-dream-cyan flex-shrink-0" />
                                  )}
                                  <span className="text-[11px] font-mono text-white/60">{isMint ? 'Minted' : 'Transfer'}</span>
                                </div>
                                <div className="text-[11px] font-mono text-white/30 text-right">
                                  {isMint ? (
                                    <span>→ {truncateAddress(h.to)}</span>
                                  ) : (
                                    <span>{truncateAddress(h.from)} → {truncateAddress(h.to)}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TokenModal;
