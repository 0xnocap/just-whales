import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Coins, Search, Sparkles, Minus, Plus, Loader2, X, ArrowLeftRight, ChevronLeft, ExternalLink, Copy, Check, User, Clock, Tag, ArrowUpRight, ArrowDownLeft, Grid3X3, List, Filter, ChevronDown, ChevronUp, Star, Zap, ShoppingCart, Trash2 } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import {
  readTotalSupply, readMaxSupply, readMintPrice,
  readIsPublicMintActive, readMaxPerAddress,
  readTokenURI, decodeTokenURI, waitForTransaction,
  contractAddress, contractAbi,
  marketplaceAddress, marketplaceAbi,
  pathUSDAddress, pathUSDAbi,
  readNextListingId, readListing, readPathUSDAllowance,
  readOwnerOf, readIsApprovedForAll, readIsListingValid,
  type TokenMetadata,
} from './contract';
import { formatEther, parseEther, formatUnits, parseUnits } from 'viem';
import { Routes, Route, useNavigate, useLocation, Link, useParams } from 'react-router-dom';

// --- Helpers ---

function truncateAddress(addr: string) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(timestamp: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

function timeUntil(timestamp: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;
  if (diff <= 0) return 'Expired';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// --- Blockies Avatar ---
const BlockiesAvatar = ({ address, size = 32 }: { address: string; size?: number }) => {
  // Simple deterministic color from address
  const hash = address.toLowerCase();
  const hue = parseInt(hash.slice(2, 6), 16) % 360;
  const hue2 = parseInt(hash.slice(6, 10), 16) % 360;
  return (
    <div
      className="rounded-full flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${hue2}, 70%, 40%))`,
      }}
    />
  );
};

// --- Copy Button ---
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-white/30 hover:text-dream-cyan transition-colors cursor-pointer"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

// --- Token Modal ---

type ModalTokenProps = TokenMetadata & {
  id: number;
  isListing?: boolean;
  listingData?: any;
  isOwner?: boolean;
  isSeller?: boolean;
  ownerAddress?: string;
  refetch?: () => void;
};

const TokenModal = ({ token, onClose }: { token: ModalTokenProps | null; onClose: () => void }) => {
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
    fetch(`/api/token/${token.id}/history`)
      .then(r => r.json())
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
      if (token.refetch) token.refetch();
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
      if (token.refetch) token.refetch();
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
      if (token.refetch) token.refetch();
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
        className="relative z-10 bg-[#18181b] border border-white/[0.08] w-full md:w-[64rem] flex flex-col md:flex-row shadow-2xl shadow-black/50 overflow-hidden"
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
          <div className="flex-1 overflow-y-auto flex flex-col px-6 md:pr-8 md:pl-2 pb-8 divide-y divide-white/[0.04]">

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

// --- Background Components ---

const DreamwaveOcean = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-b from-dream-blue/20 via-dream-purple/10 to-transparent blur-[100px]" />
      <div className="absolute bottom-0 w-full h-2/3">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[300%] h-full bg-gradient-to-t from-dream-cyan/10 to-transparent backdrop-blur-[2px]"
            style={{
              bottom: `${-20 + i * 10}%`,
              left: '-100%',
              opacity: 0.3 - i * 0.05,
              zIndex: 10 - i
            }}
            animate={{
              x: i % 2 === 0 ? ['-10%', '10%', '-10%'] : ['10%', '-10%', '10%'],
              y: [0, 20, 0],
              scaleY: [1, 1.1, 1]
            }}
            transition={{ duration: 10 + i * 2, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, opacity: Math.random() * 0.3 }}
          animate={{ y: [0, -100, 0], opacity: [0, 0.4, 0] }}
          transition={{ duration: 5 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 5 }}
        />
      ))}
    </div>
  );
};

// --- Skeleton Card ---
const SkeletonCard = () => (
  <div className="rounded-xl overflow-hidden bg-[#111113] flex flex-col animate-pulse h-full">
    <div className="w-full pb-[100%] bg-white/[0.04] relative overflow-hidden flex-shrink-0">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skeleton-shimmer" />
    </div>
    <div className="px-3 py-2.5 space-y-2 flex-grow">
      <div className="flex items-center justify-between">
        <div className="h-3 bg-white/[0.06] rounded w-16" />
        <div className="h-3 bg-white/[0.04] rounded w-8" />
      </div>
      <div className="h-3 bg-white/[0.04] rounded w-12" />
    </div>
  </div>
);

// --- NFT Card with image loading ---
const NFTCard = ({ token, isListed, listing, isOwner, isSeller, tokenOwner, rarityRank, onSelect, fetchData }: any) => {
  return (
    <div
      className="group relative cursor-pointer h-full"
      onClick={() => onSelect({ ...token, isListing: isListed, listingData: listing, isOwner, isSeller, ownerAddress: tokenOwner, refetch: fetchData })}
    >
      <div className="flex flex-col h-full rounded-xl overflow-hidden bg-[#111113] hover:bg-[#1a1a1c] transition-colors duration-300">
        <div className="relative w-full pb-[100%] overflow-hidden flex-shrink-0">
          <img
            src={token.image_data}
            alt={token.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            style={{ imageRendering: 'pixelated' }}
          />
          {/* Listed badge */}
          {isListed && (
            <div className="absolute top-2 right-2 z-10 bg-dream-cyan/90 text-[#0a0a0c] px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">
              LISTED
            </div>
          )}
          {/* Owner badge */}
          {isOwner && !isListed && (
            <div className="absolute top-2 right-2 z-10 bg-dream-purple/80 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">
              OWNED
            </div>
          )}
          {/* Rarity rank badge */}
          {rarityRank && (
            <div className="absolute bottom-2 left-2 z-10 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 text-amber-400" />
              <span className="text-[9px] font-mono text-white/70 font-bold">#{rarityRank}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col px-3 py-2.5 flex-grow">
          <div className="flex items-baseline justify-between mb-1.5">
            <h3 className="font-sans font-bold text-white/90 text-[13px] leading-none truncate">{token.name.split(' ')[0]}</h3>
            <span className="font-mono text-[11px] text-white/30 font-medium ml-1">{token.name.split(' ')[1] || ''}</span>
          </div>
          {isListed ? (
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-white text-[14px] leading-none">
                ${Number(formatUnits(listing.price, 6)).toFixed(2)}
              </span>
              {listing.expiresAt > 0n && (
                <span className="text-[9px] font-mono text-white/20 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />{timeUntil(Number(listing.expiresAt))}
                </span>
              )}
            </div>
          ) : (
            <div className="h-[17px]" />
          )}
        </div>
      </div>
    </div>
  );
};
// --- Sweep Bar ---

const SweepBar = ({
  selectedListings,
  onRemove,
  onClearAll,
  onSweep,
  isSweeping,
  sweepResult,
}: {
  selectedListings: any[];
  onRemove: (id: bigint) => void;
  onClearAll: () => void;
  onSweep: () => void;
  isSweeping: boolean;
  sweepResult: { succeeded: number; failed: number } | null;
}) => {
  const totalCost = selectedListings.reduce((sum, l) => sum + Number(l.price), 0);
  const totalUSD = (totalCost / 1e6).toFixed(2);

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed left-1/2 -translate-x-1/2 z-[150] w-full max-w-2xl px-4"
      style={{ bottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}
    >
      <div
        className="relative rounded-2xl border border-white/10 overflow-hidden"
        style={{
          background: 'rgba(10,10,14,0.92)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 0 60px rgba(34,211,238,0.12), 0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Glow line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-dream-cyan/60 to-transparent" />

        <div className="px-5 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-dream-cyan" />
              <span className="font-mono text-[11px] font-bold text-dream-cyan uppercase tracking-[0.2em]">
                Floor Sweep
              </span>
              <span className="bg-dream-cyan/15 text-dream-cyan font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                {selectedListings.length} selected
              </span>
            </div>
            <button
              onClick={onClearAll}
              className="text-white/30 hover:text-white/70 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Token chips */}
          {selectedListings.length > 0 && (
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
              {selectedListings.map((l) => (
                <div
                  key={String(l.id)}
                  className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 flex-shrink-0"
                >
                  <span className="font-mono text-white/70 text-[10px]">
                    #{String(l.tokenId)}
                  </span>
                  <span className="font-mono text-dream-cyan text-[10px] font-bold">
                    ${(Number(l.price) / 1e6).toFixed(2)}
                  </span>
                  <button
                    onClick={() => onRemove(l.id)}
                    className="text-white/20 hover:text-white/60 transition-colors cursor-pointer ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer: total + buy button */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[9px] font-mono text-white/30 uppercase tracking-[0.15em] mb-0.5">Total</div>
              <div className="text-2xl font-black text-white">
                ${totalUSD}
                <span className="text-sm font-normal text-white/30 ml-1">pathUSD</span>
              </div>
            </div>

            {sweepResult ? (
              <div className={`font-mono text-xs font-bold px-4 py-2 rounded-xl ${
                sweepResult.failed === 0
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
              }`}>
                ✓ {sweepResult.succeeded} bought{sweepResult.failed > 0 ? `, ${sweepResult.failed} skipped` : ''}
              </div>
            ) : (
              <button
                onClick={onSweep}
                disabled={isSweeping || selectedListings.length === 0}
                className="flex items-center gap-2 bg-dream-cyan hover:bg-dream-cyan/90 text-[#0a0a0c] font-black font-mono text-sm px-6 py-3 rounded-xl tracking-[0.05em] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-dream-cyan/20"
              >
                {isSweeping ? (
                  <><Loader2 className="animate-spin w-4 h-4" /> SWEEPING...</>
                ) : (
                  <><ShoppingCart className="w-4 h-4" /> BUY {selectedListings.length}</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Fishing Pole Icon ---
const FishingPoleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Pole */}
    <path d="m2 22 17-17" />
    {/* Reel */}
    <circle cx="7" cy="17" r="2" />
    <path d="m7 17 2-2" />
    {/* Line + Hook */}
    <path d="M19 5v8a3 3 0 0 1-6 0l1.5 2" />
  </svg>
);

// --- Retro Button ---
const RetroButton = ({ icon: Icon, label, to, disabled, tooltip }: { icon: any, label: string, to: string, disabled?: boolean, tooltip?: string }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === to || (to === '/profile' && location.pathname.startsWith('/profile'));
  const onClick = () => navigate(to);

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`relative group flex flex-col items-center justify-center rounded-xl border transition-all duration-300 ${
        active
          ? 'border-dream-cyan/40 bg-white/[0.08] backdrop-blur-xl shadow-[0_0_15px_rgba(34,211,238,0.15)]'
          : disabled
            ? 'border-transparent bg-transparent opacity-40 cursor-not-allowed'
            : 'border-transparent bg-transparent hover:bg-white/[0.04]'
      }`}
      style={{ width: 'clamp(3.5rem, 6vw, 6rem)', height: 'clamp(3.5rem, 6vw, 6rem)' }}
      whileHover={disabled ? {} : { scale: 1.05, y: -2 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
    >
      <Icon className={`mb-1 z-10 transition-colors duration-300 ${active ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`} style={{ width: 'clamp(1.1rem, 1.5vw, 1.25rem)', height: 'clamp(1.1rem, 1.5vw, 1.25rem)' }} />
      <span className={`font-mono font-bold tracking-[0.15em] uppercase z-10 transition-colors duration-300 ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`} style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
        {tooltip && !active ? tooltip : label}
      </span>
    </motion.button>
  );
};

// --- Trade Page ---

const TradePage = ({ onSelectToken, onSweepModeChange }: { onSelectToken: (t: any) => void; onSweepModeChange?: (active: boolean) => void }) => {
  const { isConnected, address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [searchQuery, setSearchQuery] = useState('');
  const [tokens, setTokens] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [ownerMap, setOwnerMap] = useState<Record<string, string>>({});
  const [totalMinted, setTotalMinted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [nextIdDesc, setNextIdDesc] = useState(-1);
  const [nextIdAsc, setNextIdAsc] = useState(0);
  const [filter, setFilter] = useState<'all' | 'listed' | 'unlisted'>('all');
  const [sort, setSort] = useState<'price_asc' | 'price_desc' | 'id_asc' | 'id_desc' | 'rarity_asc' | 'rarity_desc'>('price_asc');
  const [collectionStats, setCollectionStats] = useState<any>(null);
  const BATCH = 20;
  const sentinelRef = useRef<HTMLDivElement>(null);

  // --- Sweep state ---
  const [sweepMode, setSweepMode] = useState(false);
  const [sweepSelected, setSweepSelected] = useState<any[]>([]);
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const [sweepError, setSweepError] = useState('');

  // Trait filter state
  type CollectionData = {
    total: number;
    traitsIndex: Record<string, Record<string, number>>;
    rarityRanks: Record<string, number>;
    rarityScores: Record<string, number>;
    tokenTraits: Record<string, Record<string, string>>;
  };
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [traitFilters, setTraitFilters] = useState<Record<string, string[]>>({});
  const [openTraitSections, setOpenTraitSections] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Filtered loading state
  const [filteredTokens, setFilteredTokens] = useState<any[]>([]);
  const [filteredPage, setFilteredPage] = useState(0);
  const [loadingFiltered, setLoadingFiltered] = useState(false);
  const [filteredMatchIds, setFilteredMatchIds] = useState<number[]>([]);

  const loadBatchDesc = useCallback(async (fromId: number) => {
    if (fromId < 0) return;
    const endId = Math.max(fromId - BATCH + 1, 0);
    const ids: number[] = [];
    for (let i = fromId; i >= endId; i--) ids.push(i);
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const uri = await readTokenURI(BigInt(id));
          return { ...decodeTokenURI(uri), id };
        } catch { return null; }
      })
    );
    const valid = results.filter(Boolean);
    setTokens(prev => {
      const newMap = new Map(prev.map((t: any) => [t.id, t]));
      valid.forEach((t: any) => newMap.set(t.id, t));
      return Array.from(newMap.values()).sort((a: any, b: any) => b.id - a.id);
    });
    setNextIdDesc(endId - 1);
  }, []);

  const loadBatchAsc = useCallback(async (fromId: number, maxId: number) => {
    if (fromId >= maxId) return;
    const endId = Math.min(fromId + BATCH - 1, maxId - 1);
    const ids: number[] = [];
    for (let i = fromId; i <= endId; i++) ids.push(i);
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const uri = await readTokenURI(BigInt(id));
          return { ...decodeTokenURI(uri), id };
        } catch { return null; }
      })
    );
    const valid = results.filter(Boolean);
    setTokens(prev => {
      const newMap = new Map(prev.map((t: any) => [t.id, t]));
      valid.forEach((t: any) => newMap.set(t.id, t));
      return Array.from(newMap.values()).sort((a: any, b: any) => b.id - a.id);
    });
    setNextIdAsc(endId + 1);
  }, []);

  // Load specific token IDs from chain (for filtered views)
  const loadSpecificIds = useCallback(async (ids: number[]) => {
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const uri = await readTokenURI(BigInt(id));
          return { ...decodeTokenURI(uri), id };
        } catch { return null; }
      })
    );
    return results.filter(Boolean);
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch owners from subgraph
    try {
      const res = await fetch('/api/owners');
      const data = await res.json();
      setOwnerMap(data);
    } catch (err) { console.error('Owner fetch error:', err); }

    // Fetch collection stats
    try {
      const res = await fetch('/api/collection/stats');
      const data = await res.json();
      setCollectionStats(data);
    } catch (err) { console.error('Stats fetch error:', err); }

    // Fetch listings
    try {
      const nextMarketId = await readNextListingId();
      const activeListings = [];
      for (let i = 0n; i < nextMarketId; i++) {
        try {
          const listing = await readListing(i);
          if (listing.active) {
            // Check expiration
            const now = BigInt(Math.floor(Date.now() / 1000));
            if (listing.expiresAt === 0n || now <= listing.expiresAt) {
              const uri = await readTokenURI(listing.tokenId);
              const metadata = decodeTokenURI(uri);
              activeListings.push({ ...listing, id: i, metadata });
            }
          }
        } catch (e) {}
      }
      setListings(activeListings);
    } catch (err) { console.error('Marketplace fetch error:', err); }

    // Fetch tokens
    try {
      const supply = await readTotalSupply();
      const total = Number(supply);
      setTotalMinted(total);
      if (total > 0) {
        await loadBatchDesc(total - 1);
      }
    } catch (err) { console.error('Gallery fetch error:', err); }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [isConnected, address]);

  // Load collection data (traits index + rarity)
  useEffect(() => {
    fetch('/collection-data.json')
      .then(r => r.json())
      .then(data => setCollectionData(data))
      .catch(err => console.error('Collection data error:', err));
  }, []);

  // Toggle a trait filter value
  const toggleTraitFilter = (traitType: string, value: string) => {
    setTraitFilters(prev => {
      const current = prev[traitType] || [];
      if (current.includes(value)) {
        const updated = current.filter(v => v !== value);
        if (updated.length === 0) {
          const { [traitType]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [traitType]: updated };
      }
      return { ...prev, [traitType]: [...current, value] };
    });
  };

  const clearAllFilters = () => {
    setTraitFilters({});
    setFilteredTokens([]);
    setFilteredPage(0);
    setFilteredMatchIds([]);
  };
  const activeFilterCount = (Object.values(traitFilters) as string[][]).reduce((sum, arr) => sum + arr.length, 0);

  // When trait filters change, compute matching IDs and load first batch from chain
  useEffect(() => {
    if (!collectionData || activeFilterCount === 0) {
      setFilteredTokens([]);
      setFilteredMatchIds([]);
      setFilteredPage(0);
      return;
    }

    // Find all token IDs matching all active filters (AND logic)
    const matchingIds: number[] = [];
    for (let id = 0; id < collectionData.total; id++) {
      const tokenTraits = collectionData.tokenTraits[String(id)];
      if (!tokenTraits) continue;
      const matches = (Object.entries(traitFilters) as [string, string[]][]).every(([traitType, values]) => {
        return values.includes(tokenTraits[traitType]);
      });
      if (matches) matchingIds.push(id);
    }

    setFilteredMatchIds(matchingIds);
    setFilteredPage(0);
    setFilteredTokens([]);

    // Load first batch of matching tokens from chain
    if (matchingIds.length > 0) {
      setLoadingFiltered(true);
      const firstBatch = matchingIds.slice(0, BATCH);
      loadSpecificIds(firstBatch).then(loaded => {
        setFilteredTokens(loaded as any[]);
        setFilteredPage(1);
        setLoadingFiltered(false);
      });
    }
  }, [traitFilters, collectionData]);

  useEffect(() => {
    if (sort === 'id_asc' && nextIdAsc === 0 && totalMinted > 0 && !loadingMore && activeFilterCount === 0) {
      setLoadingMore(true);
      loadBatchAsc(0, totalMinted).then(() => setLoadingMore(false));
    }
  }, [sort, nextIdAsc, totalMinted]);

  // Load more filtered tokens
  const loadMoreFiltered = useCallback(async () => {
    if (loadingFiltered || filteredMatchIds.length === 0) return;
    const start = filteredPage * BATCH;
    if (start >= filteredMatchIds.length) return;
    setLoadingFiltered(true);
    const batch = filteredMatchIds.slice(start, start + BATCH);
    const loaded = await loadSpecificIds(batch);
    setFilteredTokens(prev => [...prev, ...(loaded as any[])]);
    setFilteredPage(prev => prev + 1);
    setLoadingFiltered(false);
  }, [filteredPage, filteredMatchIds, loadingFiltered, loadSpecificIds]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        try {
          if (activeFilterCount > 0) {
            await loadMoreFiltered();
          } else {
            if (sort === 'id_asc') {
              if (nextIdAsc < totalMinted) {
                await loadBatchAsc(nextIdAsc, totalMinted);
              }
            } else {
              if (nextIdDesc >= 0) {
                await loadBatchDesc(nextIdDesc);
              }
            }
          }
        } finally {
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [nextIdDesc, nextIdAsc, loadBatchDesc, loadBatchAsc, sort, totalMinted, activeFilterCount, loadMoreFiltered]);

  // Choose data source: filtered tokens when filters active, else normal tokens
  const isFiltered = activeFilterCount > 0;

  // Merge listings with gallery (for unfiltered view)
  const unifiedTokens = [
    ...listings.map(l => ({ ...l.metadata, id: Number(l.tokenId), isListing: true, listingData: l })),
    ...tokens.filter(t => !listings.some(l => Number(l.tokenId) === t.id))
  ];

  // Base display tokens
  let displayTokens = isFiltered ? [...filteredTokens] : [...unifiedTokens];

  // Apply status filter
  if (filter === 'listed') displayTokens = displayTokens.filter(t => t.isListing);
  if (filter === 'unlisted') displayTokens = displayTokens.filter(t => !t.isListing);
  if (searchQuery) displayTokens = displayTokens.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(t.id).includes(searchQuery));

  // Enrich filtered tokens with listing data
  if (isFiltered) {
    displayTokens = displayTokens.map(t => {
      const listing = listings.find(l => Number(l.tokenId) === t.id);
      if (listing) return { ...t, isListing: true, listingData: listing };
      return t;
    });
  }

  // Sort — listings always float above unlisted; within each group apply the chosen sort
  displayTokens = [...displayTokens].sort((a, b) => {
    const aListed = !!a.isListing;
    const bListed = !!b.isListing;

    // Always: listed above unlisted
    if (aListed && !bListed) return -1;
    if (!aListed && bListed) return 1;

    // Both listed: sort by price
    if (aListed && bListed) {
      const aPrice = Number(a.listingData.price);
      const bPrice = Number(b.listingData.price);
      if (sort === 'price_desc') return bPrice - aPrice;
      return aPrice - bPrice; // price_asc is default for listings
    }

    // Both unlisted: apply chosen secondary sort
    if (sort === 'rarity_asc' && collectionData) {
      const aRank = collectionData.rarityRanks[String(a.id)] || 9999;
      const bRank = collectionData.rarityRanks[String(b.id)] || 9999;
      return aRank - bRank;
    }
    if (sort === 'rarity_desc' && collectionData) {
      const aRank = collectionData.rarityRanks[String(a.id)] || 0;
      const bRank = collectionData.rarityRanks[String(b.id)] || 0;
      return bRank - aRank;
    }
    if (sort === 'id_desc') return b.id - a.id;
    return a.id - b.id; // default: id asc
  });

  // Has more to load?
  const hasMoreFiltered = isFiltered && (filteredPage * BATCH) < filteredMatchIds.length;
  const hasMoreUnfiltered = !isFiltered && (nextIdDesc >= 0 || nextIdAsc < totalMinted);

  // Floor price from listings
  const floorPrice = listings.length > 0
    ? Math.min(...listings.map(l => Number(formatUnits(l.price, 6))))
    : 0;

  return (
    <div className="w-full" style={{ maxWidth: '100%' }}>
      {/* Collection Banner with Embedded Info */}
      <div className="relative rounded-2xl overflow-hidden mb-6 flex flex-col justify-end" style={{ minHeight: '300px' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c4a6e] via-[#083344] to-[#1e1b4b] -z-10" />
        <div className="absolute inset-0 opacity-40 -z-10">
          <div className="absolute inset-0 bg-gradient-to-l from-dream-cyan/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-tr from-dream-purple/20 via-transparent to-transparent" />
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-4 right-8 text-4xl opacity-20 -z-10">🐋</div>
        <div className="absolute bottom-16 right-24 text-2xl opacity-15 -z-10">🦈</div>
        <div className="absolute top-6 right-44 text-xl opacity-10 -z-10">🦭</div>

        {/* Collection Info Content (placed firmly inside the banner) */}
        <div className="flex flex-col justify-end pr-5 sm:pr-8" style={{ paddingLeft: '10px', paddingBottom: '10px' }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-end" style={{ gap: '10px' }}>
            {/* Avatar inside banner with no stroke */}
            <div className="relative flex-shrink-0 z-10 w-24 h-24 rounded-2xl overflow-hidden shadow-2xl">
              <img src="/collections/whale-town/collection_image.png" alt="Whale Town" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
            </div>
            
            {/* Name & socials */}
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md">Whale Town</h1>
                {/* Verified badge */}
                <svg viewBox="0 0 22 22" className="w-5 h-5 flex-shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" fill="none">
                  <path d="M11 0l2.8 3.2L17.5 2l.8 4.2L22 7.8l-2 3.6 2 3.6-3.7 1.6-.8 4.2-3.7-1.2L11 22l-2.8-2.2-3.7 1.2-.8-4.2L0 15.2l2-3.6L0 8l3.7-1.8.8-4.2 3.7 1.2L11 0z" fill="#22d3ee"/>
                  <path d="M7 11l2.5 2.5L15 8.5" stroke="#0a0a0c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <p className="text-white/80 text-[13px] font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Sealions, Sharks, and Whales, oh my! The first onchain collection on Tempo.</p>
                <a href="https://x.com/whaletowntempo" target="_blank" rel="noopener noreferrer" className="text-white hover:text-dream-cyan transition-colors drop-shadow-md">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { label: 'Floor', value: floorPrice > 0 ? `$${floorPrice.toFixed(2)}` : '—' },
          { label: 'Items', value: '3,333' },
          { label: 'Holders', value: collectionStats ? collectionStats.holders.toLocaleString() : '—' },
          { label: 'Listed', value: listings.length > 0 ? listings.length.toString() : '0' },
          { label: 'Transfers', value: collectionStats ? collectionStats.totalTransfers.toString() : '—' },
        ].map(stat => (
          <div key={stat.label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2 flex-1 min-w-[80px]">
            <div className="text-[10px] font-mono text-white/50 uppercase tracking-[0.1em]">{stat.label}</div>
            <div className="text-[15px] font-bold text-white mt-0.5">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter & Sort Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border ${
            showFilters || activeFilterCount > 0
              ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30'
              : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:border-white/20'
          }`}
        >
          <Filter className="w-3 h-3" />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>

        {/* Sweep mode toggle */}
        {listings.length > 0 && (
          <button
            onClick={() => {
              const next = !sweepMode;
              setSweepMode(next);
              onSweepModeChange?.(next);
              if (!next) { setSweepSelected([]); setSweepResult(null); setSweepError(''); }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border ${
              sweepMode
                ? 'bg-dream-cyan/20 text-dream-cyan border-dream-cyan/40 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:border-white/20'
            }`}
          >
            <Zap className="w-3 h-3" />
            Sweep{sweepMode && sweepSelected.length > 0 ? ` (${sweepSelected.length})` : ''}
          </button>
        )}

        {/* Quick-add floor buttons (only in sweep mode) */}
        {sweepMode && listings.length > 0 && (
          <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
            {[3, 5, 10].map(n => (
              <button
                key={n}
                onClick={() => {
                  const floor = [...listings]
                    .sort((a, b) => Number(a.price) - Number(b.price))
                    .slice(0, n);
                  setSweepSelected(floor);
                  setSweepResult(null);
                }}
                className="px-3 py-1.5 rounded-md font-mono text-[10px] font-bold text-white/40 hover:text-dream-cyan hover:bg-dream-cyan/10 transition-all cursor-pointer tracking-[0.1em]"
              >
                Floor {n}
              </button>
            ))}
          </div>
        )}

        {/* Status filter */}
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
          {(['all', 'listed', 'unlisted'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer ${
                filter === f
                  ? 'bg-dream-cyan/15 text-dream-cyan'
                  : 'text-white/30 hover:text-white/60'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value as any)}
          className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 font-mono text-[10px] text-white/60 outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors"
        >
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
          <option value="id_asc">Token ID ↑</option>
          <option value="id_desc">Token ID ↓</option>
          <option value="rarity_asc">Rarity: Rare First</option>
          <option value="rarity_desc">Rarity: Common First</option>
        </select>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-3.5 h-3.5 text-white/20" />
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg font-mono text-[11px] text-white placeholder:text-white/20 focus:border-dream-cyan/30 outline-none transition-all"
          />
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(Object.entries(traitFilters) as [string, string[]][]).map(([traitType, values]) =>
            values.map(value => (
              <button
                key={`${traitType}-${value}`}
                onClick={() => toggleTraitFilter(traitType, value)}
                className="flex items-center gap-1 px-2 py-1 bg-dream-cyan/10 border border-dream-cyan/20 rounded-lg text-dream-cyan font-mono text-[10px] hover:bg-dream-cyan/20 transition-colors cursor-pointer"
              >
                <span className="text-dream-cyan/50">{traitType}:</span> {value}
                <X className="w-2.5 h-2.5 ml-0.5" />
              </button>
            ))
          )}
          <button
            onClick={clearAllFilters}
            className="px-2 py-1 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/30 font-mono text-[10px] hover:text-white/60 transition-colors cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main content area with optional filter sidebar */}
      <div className={`flex gap-4 ${showFilters ? '' : ''}`}>
        {/* Trait filter sidebar */}
        {showFilters && collectionData && (
          <div className="w-56 flex-shrink-0 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 self-start sticky top-28 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.15em] font-bold">Traits</span>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} className="text-[9px] font-mono text-dream-cyan/60 hover:text-dream-cyan cursor-pointer">Clear</button>
              )}
            </div>
            {Object.entries(collectionData.traitsIndex)
              .filter(([traitType]) => traitType !== 'Trait Count')
              .map(([traitType, values]) => {
                const isOpen = openTraitSections[traitType] || false;
                const selectedValues = traitFilters[traitType] || [];
                const sortedValues = Object.entries(values).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={traitType} className="border-b border-white/[0.04] last:border-b-0">
                    <button
                      onClick={() => setOpenTraitSections(prev => ({ ...prev, [traitType]: !isOpen }))}
                      className="w-full flex items-center justify-between py-2.5 text-left cursor-pointer group"
                    >
                      <span className="text-[11px] font-mono text-white/60 group-hover:text-white/80 transition-colors">
                        {traitType}
                        {selectedValues.length > 0 && (
                          <span className="ml-1 text-dream-cyan">({selectedValues.length})</span>
                        )}
                      </span>
                      {isOpen ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
                    </button>
                    {isOpen && (
                      <div className="pb-2.5 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                        {sortedValues.map(([value, count]) => {
                          const isSelected = selectedValues.includes(value);
                          return (
                            <button
                              key={value}
                              onClick={() => toggleTraitFilter(traitType, value)}
                              className={`flex items-center justify-between px-2 py-1.5 rounded-md text-left cursor-pointer transition-colors font-mono text-[10px] ${
                                isSelected
                                  ? 'bg-dream-cyan/15 text-dream-cyan'
                                  : 'text-white/40 hover:bg-white/[0.04] hover:text-white/60'
                              }`}
                            >
                              <span className="truncate">{value === 'None' ? 'None' : value}</span>
                              <span className="text-[9px] text-white/20 ml-1 flex-shrink-0">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* NFT Grid */}
        <div className="flex-1 min-w-0">
          {(loading || (unifiedTokens.length === 0 && !isFiltered && totalMinted > 0)) ? (
            <div className={`grid gap-2.5 ${showFilters ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
              {Array.from({ length: BATCH }).map((_, i) => <SkeletonCard key={`init-skeleton-${i}`} />)}
            </div>
          ) : (isFiltered && filteredTokens.length === 0) ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1">
                <Loader2 className="animate-spin text-dream-cyan/40 w-4 h-4" />
                <span className="font-mono text-white/30 text-[10px] tracking-wider">
                  Loading {filteredMatchIds.length} matching tokens...
                </span>
              </div>
              <div className={`grid gap-2.5 ${showFilters ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
                {Array.from({ length: Math.min(BATCH, filteredMatchIds.length) }).map((_, i) => <SkeletonCard key={`filter-skeleton-${i}`} />)}
              </div>
            </div>
          ) : displayTokens.length === 0 && !loading && !loadingFiltered ? (
            <div className="text-center py-20 border border-dashed border-white/[0.06] rounded-2xl bg-white/[0.02]">
              <p className="font-mono text-white/20 uppercase tracking-widest text-[11px]">
                {activeFilterCount > 0 ? `No tokens match your filters.` : 'No tokens found.'}
              </p>
            </div>
           ) : (
            <div className={`grid gap-2.5 ${showFilters ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
              {displayTokens.map((token) => {
                const isListed = !!token.isListing;
                const listing = token.listingData;
                const tokenOwner = ownerMap[token.id];
                const isOwner = isConnected && address && tokenOwner?.toLowerCase() === address.toLowerCase();
                const isSeller = isListed && isConnected && address && listing.seller.toLowerCase() === address.toLowerCase();
                const rarityRank = collectionData?.rarityRanks?.[String(token.id)];
                const isSweepSelected = sweepMode && isListed && sweepSelected.some(s => String(s.id) === String(listing?.id));

                return (
                  <div key={isListed ? `listing-${listing.id}` : `gallery-${token.id}`} className="relative">
                    {/* Sweep mode checkbox overlay */}
                    {sweepMode && isListed && !isSeller && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSweepResult(null);
                          if (isSweepSelected) {
                            setSweepSelected(prev => prev.filter(s => String(s.id) !== String(listing.id)));
                          } else {
                            setSweepSelected(prev => [...prev, listing]);
                          }
                        }}
                        className={`absolute top-2 left-2 z-30 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
                          isSweepSelected
                            ? 'bg-dream-cyan border-dream-cyan shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                            : 'bg-black/60 border-white/30 hover:border-dream-cyan/60 backdrop-blur-sm'
                        }`}
                      >
                        {isSweepSelected && <Check className="w-3 h-3 text-[#0a0a0c]" strokeWidth={3} />}
                      </button>
                    )}
                    {/* Sweep mode dim overlay on non-listed cards */}
                    {sweepMode && !isListed && (
                      <div className="absolute inset-0 z-20 rounded-xl bg-black/50 pointer-events-none" />
                    )}
                    <NFTCard
                      token={token}
                      isListed={isListed}
                      listing={listing}
                      isOwner={isOwner}
                      isSeller={isSeller}
                      tokenOwner={tokenOwner}
                      rarityRank={rarityRank}
                      onSelect={sweepMode ? () => {} : onSelectToken}
                      fetchData={fetchData}
                    />
                  </div>
                );
              })}
              {/* Skeleton placeholders while loading next batch */}
              {loadingMore && Array.from({ length: BATCH }).map((_, i) => (
                <SkeletonCard key={`skeleton-more-${i}`} />
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {(hasMoreFiltered || hasMoreUnfiltered) && !searchQuery && filter === 'all' && (
            <>
              {(loadingMore || loadingFiltered) && (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="w-4 h-4 text-dream-cyan/50 animate-spin" />
                  <span className="font-mono text-white/25 text-[10px] tracking-wider">Loading more...</span>
                </div>
              )}
              <div ref={sentinelRef} className="w-full h-[100px] absolute bottom-10 pointer-events-none" />
            </>
          )}

          {/* Match count for filtered results */}
          {isFiltered && filteredMatchIds.length > 0 && displayTokens.length > 0 && (
            <div className="text-center py-3">
              <span className="font-mono text-white/20 text-[10px] tracking-wider">
                Showing {displayTokens.length} of {filteredMatchIds.length} matching tokens
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sweep Bar */}
      <AnimatePresence>
        {sweepMode && (
          <SweepBar
            selectedListings={sweepSelected}
            onRemove={(id) => setSweepSelected(prev => prev.filter(s => String(s.id) !== String(id)))}
            onClearAll={() => { setSweepSelected([]); setSweepResult(null); }}
            isSweeping={isSweeping}
            sweepResult={sweepResult}
            onSweep={async () => {
              if (!isConnected || sweepSelected.length === 0) return;
              setIsSweeping(true);
              setSweepError('');
              setSweepResult(null);
              try {
                const totalCost = sweepSelected.reduce((sum: bigint, l: any) => sum + BigInt(l.price), 0n);
                const allowance = await readPathUSDAllowance(address!, marketplaceAddress);
                if (allowance < totalCost) {
                  const approveHash = await writeContractAsync({
                    address: pathUSDAddress,
                    abi: pathUSDAbi,
                    functionName: 'approve',
                    args: [marketplaceAddress, totalCost],
                  } as any);
                  await waitForTransaction(approveHash);
                }
                const listingIds = sweepSelected.map((l: any) => BigInt(l.id));
                const hash = await writeContractAsync({
                  address: marketplaceAddress,
                  abi: marketplaceAbi,
                  functionName: 'batchBuy',
                  args: [listingIds],
                } as any);
                await waitForTransaction(hash);
                setSweepResult({ succeeded: sweepSelected.length, failed: 0 });
                setSweepSelected([]);
                fetchData();
              } catch (err: any) {
                setSweepError(err.shortMessage || err.message || 'Sweep failed');
              } finally {
                setIsSweeping(false);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Profile Page ---

const ProfilePage = ({ onSelectToken }: { onSelectToken: (t: any) => void }) => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { address: paramAddress } = useParams<{ address: string }>();
  const profileAddress = paramAddress || connectedAddress || '';
  const isOwnProfile = isConnected && connectedAddress?.toLowerCase() === profileAddress.toLowerCase();

  const [tab, setTab] = useState<'collected' | 'listed' | 'activity'>('collected');
  const [ownedTokenIds, setOwnedTokenIds] = useState<number[]>([]);
  const [ownedTokens, setOwnedTokens] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Infinite scroll state
  const BATCH = 20;
  const [nextLoadIndex, setNextLoadIndex] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch true on-chain balance to check against indexer
  const { data: onChainBalance } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: contractAbi,
    functionName: 'balanceOf',
    args: profileAddress ? [profileAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!profileAddress,
    }
  });

  const trueBalance = onChainBalance ? Number(onChainBalance) : ownedTokenIds.length;
  const isSyncing = trueBalance > ownedTokenIds.length;

  useEffect(() => {
    if (!profileAddress) return;
    setLoading(true);
    
    const fetchProfile = async () => {
      try {
        // Get owned tokens from subgraph
        const res = await fetch(`/api/profile/${profileAddress}`);
        const data = await res.json();
        setActivity(data.activity || []);
        
        const ids = data.ownedTokenIds || [];
        setOwnedTokenIds(ids);

        // Fetch metadata for first batch ONLY
        const initialIds = ids.slice(0, BATCH);
        const tokenDetails = [];
        const chunkSize = 10;
        
        for (let i = 0; i < initialIds.length; i += chunkSize) {
          const chunk = initialIds.slice(i, i + chunkSize);
          const chunkResults = await Promise.all(
            chunk.map(async (id: number) => {
              try {
                const uri = await readTokenURI(BigInt(id));
                return { ...decodeTokenURI(uri), id };
              } catch (e) {
                console.error(`Failed to fetch URI for token ${id}:`, e);
                return null;
              }
            })
          );
          tokenDetails.push(...chunkResults);
        }
        
        setOwnedTokens(tokenDetails.filter(Boolean));
        setNextLoadIndex(BATCH);

        // Fetch active listings by this address
        try {
          const nextMarketId = await readNextListingId();
          const userListings = [];
          for (let i = 0n; i < nextMarketId; i++) {
            try {
              const listing = await readListing(i);
              if (listing.active && listing.seller.toLowerCase() === profileAddress.toLowerCase()) {
                const now = BigInt(Math.floor(Date.now() / 1000));
                if (listing.expiresAt === 0n || now <= listing.expiresAt) {
                  const uri = await readTokenURI(listing.tokenId);
                  const metadata = decodeTokenURI(uri);
                  userListings.push({ ...listing, id: i, metadata });
                }
              }
            } catch {}
          }
          setListings(userListings);
        } catch {}
      } catch (err) { console.error('Profile fetch error:', err); }
      setLoading(false);
    };
    fetchProfile();
  }, [profileAddress]);

  // Infinite scroll observer for collected tab
  useEffect(() => {
    if (tab !== 'collected' || nextLoadIndex >= ownedTokenIds.length) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMoreRef.current) {
        loadingMoreRef.current = true;
        setLoadingMore(true);

        const idsToFetch = ownedTokenIds.slice(nextLoadIndex, nextLoadIndex + BATCH);
        if (idsToFetch.length === 0) {
          setLoadingMore(false);
          loadingMoreRef.current = false;
          return;
        }

        const fetchMore = async () => {
          const chunkDetails = [];
          const chunkSize = 10;
          for (let i = 0; i < idsToFetch.length; i += chunkSize) {
            const chunk = idsToFetch.slice(i, i + chunkSize);
            const chunkResults = await Promise.all(
              chunk.map(async (id: number) => {
                try {
                  const uri = await readTokenURI(BigInt(id));
                  return { ...decodeTokenURI(uri), id };
                } catch { return null; }
              })
            );
            chunkDetails.push(...chunkResults);
          }
          
          setOwnedTokens(prev => [...prev, ...chunkDetails.filter(Boolean)]);
          setNextLoadIndex(prev => prev + BATCH);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        };
        fetchMore();
      }
    }, { rootMargin: '400px' });

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    return () => observer.disconnect();
  }, [tab, nextLoadIndex, ownedTokenIds]);

  if (!profileAddress) {
    return (
      <div className="text-center py-20">
        <User className="w-12 h-12 text-white/10 mx-auto mb-4" />
        <p className="font-mono text-white/30 text-sm">Connect your wallet to view your profile</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
        <BlockiesAvatar address={profileAddress} size={56} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">{truncateAddress(profileAddress)}</h1>
            <CopyButton text={profileAddress} />
            {isOwnProfile && (
              <span className="text-[9px] font-mono text-dream-cyan bg-dream-cyan/10 border border-dream-cyan/20 rounded-full px-2 py-0.5">YOU</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-white/40">
              {trueBalance} items {isSyncing && <span className="text-amber-400/60 text-[10px] ml-1">(indexer syncing...)</span>}
            </span>
            {listings.length > 0 && (
              <span className="text-xs font-mono text-dream-purple/60">{listings.length} listed</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
        {([
          { key: 'collected', label: `Collected (${trueBalance})` },
          { key: 'listed', label: `Listed (${listings.length})` },
          { key: 'activity', label: 'Activity' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer ${
              tab === t.key
                ? 'bg-dream-cyan/15 text-dream-cyan'
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-dream-cyan w-8 h-8" />
        </div>
      ) : (
        <>
          {/* Collected Tab */}
          {tab === 'collected' && (
            ownedTokens.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
                <p className="font-mono text-white/20 text-[11px] tracking-widest">NO ITEMS</p>
              </div>
            ) : (
              <div className="w-full">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {ownedTokens.map(token => {
                    const isListed = listings.some(l => Number(l.tokenId) === token.id);
                    const listing = listings.find(l => Number(l.tokenId) === token.id);
                    return (
                      <motion.div
                        key={token.id}
                        className="group cursor-pointer rounded-xl overflow-hidden bg-[#111113] border border-white/[0.04] hover:border-white/[0.12] transition-all duration-300"
                        onClick={() => onSelectToken({ ...token, isListing: isListed, listingData: listing, isOwner: isOwnProfile, isSeller: isListed && isOwnProfile, ownerAddress: profileAddress })}
                        whileHover={{ y: -2 }}
                      >
                        <div className="relative aspect-square bg-[#0a0a0c] overflow-hidden">
                          <img src={token.image_data} alt={token.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" style={{ imageRendering: 'pixelated' }} loading="lazy" />
                          {isListed && (
                            <div className="absolute top-2 right-2 bg-dream-cyan/90 text-[#0a0a0c] px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">LISTED</div>
                          )}
                        </div>
                        <div className="px-3 py-2.5">
                          <div className="flex items-baseline justify-between">
                            <h3 className="font-sans font-bold text-white/90 text-[13px] truncate">{token.name.split(' ')[0]}</h3>
                            <span className="font-mono text-[11px] text-white/30 ml-1">{token.name.split(' ')[1]}</span>
                          </div>
                          {isListed && listing && (
                            <span className="font-bold text-white text-[13px]">${Number(formatUnits(listing.price, 6)).toFixed(2)}</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                  {loadingMore && Array.from({ length: Math.min(BATCH, ownedTokenIds.length - ownedTokens.length) }).map((_, i) => (
                    <SkeletonCard key={`skeleton-more-${i}`} />
                  ))}
                </div>
                
                {/* Infinite scroll sentinel */}
                {nextLoadIndex < ownedTokenIds.length && (
                  <>
                    {loadingMore && (
                      <div className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="w-4 h-4 text-dream-cyan/50 animate-spin" />
                        <span className="font-mono text-white/25 text-[10px] tracking-wider">Loading more...</span>
                      </div>
                    )}
                    <div ref={sentinelRef} className="w-full h-[100px] pointer-events-none opacity-0" />
                  </>
                )}
              </div>
            )
          )}

          {/* Listed Tab */}
          {tab === 'listed' && (
            listings.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
                <p className="font-mono text-white/20 text-[11px] tracking-widest">NO ACTIVE LISTINGS</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {listings.map(listing => (
                  <motion.div
                    key={`l-${listing.id}`}
                    className="group cursor-pointer rounded-xl overflow-hidden bg-[#111113] border border-white/[0.04] hover:border-white/[0.12] transition-all duration-300"
                    onClick={() => onSelectToken({ ...listing.metadata, id: Number(listing.tokenId), isListing: true, listingData: listing, isOwner: isOwnProfile, isSeller: isOwnProfile, ownerAddress: profileAddress })}
                    whileHover={{ y: -2 }}
                  >
                    <div className="relative aspect-square bg-[#0a0a0c] overflow-hidden">
                      <img src={listing.metadata.image_data} alt={listing.metadata.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" style={{ imageRendering: 'pixelated' }} />
                      <div className="absolute top-2 right-2 bg-dream-cyan/90 text-[#0a0a0c] px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">LISTED</div>
                    </div>
                    <div className="px-3 py-2.5">
                      <h3 className="font-sans font-bold text-white/90 text-[13px] truncate mb-1">{listing.metadata.name}</h3>
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-white text-[14px]">${Number(formatUnits(listing.price, 6)).toFixed(2)}</span>
                        {listing.expiresAt > 0n && (
                          <span className="text-[9px] font-mono text-white/20 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />{timeUntil(Number(listing.expiresAt))}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          )}

          {/* Activity Tab */}
          {tab === 'activity' && (
            activity.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
                <p className="font-mono text-white/20 text-[11px] tracking-widest">NO ACTIVITY</p>
              </div>
            ) : (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
                {activity.map((item, i) => {
                  const isMint = item.from === '0x0000000000000000000000000000000000000000';
                  const isSent = item.from.toLowerCase() === profileAddress.toLowerCase();
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-3">
                        {isMint ? (
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                        ) : isSent ? (
                          <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-dream-cyan/10 flex items-center justify-center">
                            <ArrowDownLeft className="w-3.5 h-3.5 text-dream-cyan" />
                          </div>
                        )}
                        <div>
                          <span className="text-[12px] font-medium text-white">
                            {isMint ? 'Minted' : isSent ? 'Sent' : 'Received'}
                          </span>
                          <span className="text-[12px] text-white/40 ml-1.5">
                            Token #{item.token_id}
                          </span>
                          <div className="text-[10px] font-mono text-white/25">
                            {isMint ? 'Mint' : `${truncateAddress(item.from)} → ${truncateAddress(item.to)}`}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-white/20">{timeAgo(item.timestamp)}</span>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};

// --- Staking Page (placeholder) ---

const StakingPage = () => {
  return (
    <div className="grid grid-cols-2 w-full" style={{ gap: 'clamp(0.75rem, 1.5vw, 1.25rem)' }}>
      <div className="border border-white/10 bg-white/5 backdrop-blur-xl" style={{ padding: 'clamp(1rem, 2vw, 1.75rem)', borderRadius: 'clamp(1rem, 1.5vw, 1.5rem)' }}>
        <h2 className="font-bold text-dream-cyan font-sans tracking-tight text-left uppercase" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)', marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>STAKING POOL</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
          <div className="flex justify-between items-end border-b border-white/5" style={{ paddingBottom: 'clamp(0.4rem, 0.8vh, 0.6rem)' }}>
            <span className="font-mono text-white/40 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(10px, 0.8vw, 12px)' }}>Total Staked</span>
            <span className="font-bold text-dream-white" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)' }}>-- OCEAN</span>
          </div>
          <div className="flex justify-between items-end border-b border-white/5" style={{ paddingBottom: 'clamp(0.4rem, 0.8vh, 0.6rem)' }}>
            <span className="font-mono text-white/40 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(10px, 0.8vw, 12px)' }}>Current APY</span>
            <span className="font-bold text-dream-cyan" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)' }}>--%</span>
          </div>
          <div className="relative group">
            <button disabled className="w-full bg-dream-cyan/20 text-dream-cyan/40 font-bold font-mono tracking-[0.2em] cursor-not-allowed" style={{ padding: 'clamp(0.4rem, 0.8vh, 0.6rem)', borderRadius: 'clamp(0.5rem, 0.8vw, 0.75rem)', fontSize: 'clamp(10px, 0.85vw, 12px)' }}>
              STAKE
            </button>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-ocean-deep/80 backdrop-blur-sm" style={{ borderRadius: 'clamp(0.5rem, 0.8vw, 0.75rem)' }}>
              <span className="font-mono font-bold text-dream-cyan/60 uppercase tracking-[0.2em]" style={{ fontSize: 'clamp(0.4rem, 0.6vw, 0.55rem)' }}>COMING SOON</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-white/10 bg-white/5 backdrop-blur-xl" style={{ padding: 'clamp(1rem, 2vw, 1.75rem)', borderRadius: 'clamp(1rem, 1.5vw, 1.5rem)' }}>
        <h2 className="font-bold text-dream-purple font-sans tracking-tight text-left uppercase" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)', marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>REWARDS</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
          <div className="flex justify-between items-end border-b border-white/5" style={{ paddingBottom: 'clamp(0.4rem, 0.8vh, 0.6rem)' }}>
            <span className="font-mono text-white/40 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(10px, 0.8vw, 12px)' }}>Unclaimed</span>
            <span className="font-bold text-dream-white" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)' }}>-- OCEAN</span>
          </div>
          <div className="flex justify-between items-end border-b border-white/5" style={{ paddingBottom: 'clamp(0.4rem, 0.8vh, 0.6rem)' }}>
            <span className="font-mono text-white/40 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(10px, 0.8vw, 12px)' }}>Daily Yield</span>
            <span className="font-bold text-dream-purple" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)' }}>-- OCEAN</span>
          </div>
          <div className="relative group">
            <button disabled className="w-full border border-dream-purple/30 text-dream-purple/40 font-bold font-mono tracking-[0.2em] cursor-not-allowed" style={{ padding: 'clamp(0.4rem, 0.8vh, 0.6rem)', borderRadius: 'clamp(0.5rem, 0.8vw, 0.75rem)', fontSize: 'clamp(10px, 0.85vw, 12px)' }}>
              CLAIM
            </button>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-ocean-deep/80 backdrop-blur-sm" style={{ borderRadius: 'clamp(0.5rem, 0.8vw, 0.75rem)' }}>
              <span className="font-mono font-bold text-dream-purple/60 uppercase tracking-[0.2em]" style={{ fontSize: 'clamp(0.4rem, 0.6vw, 0.55rem)' }}>COMING SOON</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Mint Page ---

const MintPage = ({ onMintSuccess }: { onMintSuccess: (t: TokenMetadata & { id: number }) => void }) => {
  const { address: walletAddress, isConnected } = useAccount();
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
  }, [isSuccess]);

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
      {/* Header */}
      <div className="flex justify-between items-center" style={{ marginBottom: 'clamp(1rem, 2vh, 1.5rem)' }}>
        <h2 className="font-bold text-dream-cyan font-sans tracking-tight uppercase" style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.1rem)' }}>MINT</h2>
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
            if (!mounted) return null;
            if (!account) return (
              <button onClick={openConnectModal} className="font-mono font-bold tracking-[0.1em] text-dream-cyan border border-dream-cyan/30 bg-dream-cyan/5 hover:bg-dream-cyan/10 transition-colors cursor-pointer" style={{ fontSize: 'clamp(9px, 0.75vw, 11px)', padding: 'clamp(4px, 0.4vh, 6px) clamp(10px, 1vw, 14px)', borderRadius: 'clamp(0.3rem, 0.5vw, 0.5rem)' }}>
                CONNECT
              </button>
            );
            if (chain?.unsupported) return (
              <button onClick={openChainModal} className="font-mono font-bold tracking-[0.1em] text-red-400 border border-red-400/30 bg-red-400/5 cursor-pointer" style={{ fontSize: 'clamp(9px, 0.75vw, 11px)', padding: 'clamp(4px, 0.4vh, 6px) clamp(10px, 1vw, 14px)', borderRadius: 'clamp(0.3rem, 0.5vw, 0.5rem)' }}>
                WRONG NETWORK
              </button>
            );
            return (
              <button onClick={openAccountModal} className="font-mono font-bold tracking-[0.1em] text-white/40 border border-white/10 bg-white/5 hover:border-dream-cyan/30 transition-colors cursor-pointer" style={{ fontSize: 'clamp(9px, 0.75vw, 11px)', padding: 'clamp(4px, 0.4vh, 6px) clamp(10px, 1vw, 14px)', borderRadius: 'clamp(0.3rem, 0.5vw, 0.5rem)' }}>
                {account.displayName}
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>

      {/* Supply */}
      <div style={{ marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>
        <div className="flex justify-between items-end" style={{ marginBottom: 'clamp(0.25rem, 0.4vh, 0.35rem)' }}>
          <span className="font-mono text-white/40 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(9px, 0.75vw, 11px)' }}>Supply</span>
          <span className="font-bold text-dream-white" style={{ fontSize: 'clamp(0.6rem, 0.9vw, 0.85rem)' }}>{totalSupply} / {maxSupply}</span>
        </div>
        <div className="w-full bg-white/10 rounded-full overflow-hidden" style={{ height: 'clamp(3px, 0.4vh, 5px)' }}>
          <div className="h-full bg-gradient-to-r from-dream-cyan to-dream-purple transition-all duration-500" style={{ width: `${supplyPct}%` }} />
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center" style={{ gap: 'clamp(0.3rem, 0.4vw, 0.4rem)', marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>
        <div className="rounded-full" style={{ width: 'clamp(4px, 0.4vw, 6px)', height: 'clamp(4px, 0.4vw, 6px)', background: isActive ? '#22c55e' : '#ef4444' }} />
        <span className="font-mono uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(9px, 0.7vw, 11px)', color: isActive ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)' }}>
          {isActive ? 'PUBLIC MINT ACTIVE' : 'MINT PAUSED'}
        </span>
        <span className="font-mono text-white/20" style={{ fontSize: 'clamp(9px, 0.7vw, 11px)' }}>|</span>
        <span className="font-mono text-dream-cyan/60 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(9px, 0.7vw, 11px)' }}>
          {mintPrice === 0n ? 'FREE' : `${Number(mintPrice) / 1e18} TEMPO`}
        </span>
      </div>

      {/* Count selector */}
      <div className="flex items-center justify-center" style={{ gap: 'clamp(0.75rem, 1.2vw, 1rem)', marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>
        <button
          onClick={() => setMintCount(c => Math.max(1, c - 1))}
          className="border border-white/10 bg-white/5 text-white/50 hover:border-dream-cyan/30 hover:text-dream-cyan transition-colors cursor-pointer flex items-center justify-center"
          style={{ width: 'clamp(1.5rem, 2.5vw, 2rem)', height: 'clamp(1.5rem, 2.5vw, 2rem)', borderRadius: 'clamp(0.3rem, 0.5vw, 0.5rem)' }}
        >
          <Minus style={{ width: 'clamp(0.5rem, 0.8vw, 0.7rem)' }} />
        </button>
        <span className="font-bold text-dream-white font-mono" style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)', minWidth: 'clamp(1.5rem, 2.5vw, 2rem)', textAlign: 'center' }}>{mintCount}</span>
        <button
          onClick={() => setMintCount(c => Math.min(maxPerAddr, c + 1))}
          className="border border-white/10 bg-white/5 text-white/50 hover:border-dream-cyan/30 hover:text-dream-cyan transition-colors cursor-pointer flex items-center justify-center"
          style={{ width: 'clamp(1.5rem, 2.5vw, 2rem)', height: 'clamp(1.5rem, 2.5vw, 2rem)', borderRadius: 'clamp(0.3rem, 0.5vw, 0.5rem)' }}
        >
          <Plus style={{ width: 'clamp(0.5rem, 0.8vw, 0.7rem)' }} />
        </button>
      </div>

      {/* Mint button */}
      <button
        onClick={handleMint}
        disabled={!isActive || isBusy || !isConnected}
        className={`w-full font-bold font-mono tracking-[0.2em] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center ${
          isSuccess ? '' : txError ? '' : 'bg-dream-cyan text-ocean-deep hover:bg-dream-white'
        }`}
        style={{
          padding: 'clamp(0.5rem, 1vh, 0.75rem)',
          borderRadius: 'clamp(0.5rem, 0.8vw, 0.75rem)',
          fontSize: 'clamp(10px, 0.85vw, 12px)',
          background: isSuccess ? '#22c55e' : txError ? 'transparent' : undefined,
          border: txError ? '1px solid rgba(239,68,68,0.5)' : undefined,
          color: isSuccess ? 'white' : txError ? '#ef4444' : undefined,
          gap: 'clamp(0.3rem, 0.5vw, 0.4rem)',
        }}
      >
        {isBusy && <Loader2 className="animate-spin" style={{ width: 'clamp(0.6rem, 0.8vw, 0.75rem)' }} />}
        {statusLabel}
      </button>

      {/* Error message */}
      {txError && (
        <p className="font-mono text-center" style={{ fontSize: 'clamp(9px, 0.7vw, 11px)', color: 'rgba(239,68,68,0.7)', marginTop: 'clamp(0.3rem, 0.5vh, 0.5rem)' }}>
          {(txError as any)?.shortMessage || txError.message}
        </p>
      )}
    </div>
  );
};

// --- Home Page ---

const HomePage = () => {
  const taglines = [
    { text: "it pays to be a whale.", icon: "🐋" },
    { text: "beware of sharks.", icon: "🦈" },
    { text: "everybody loves a sea lion.", icon: "🦭" },
  ];

  return (
    <div className="text-center w-full">
      {/* Hero */}
      <div className="relative inline-block mb-4">
        <motion.h1
          className="font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-dream-white via-dream-cyan to-dream-purple"
          style={{ fontSize: 'clamp(3rem, 8.5vw, 7rem)' }}
          animate={{
            filter: [
              "drop-shadow(0 0 20px rgba(34,211,238,0.2))",
              "drop-shadow(0 0 40px rgba(192,132,252,0.2))",
              "drop-shadow(0 0 20px rgba(34,211,238,0.2))"
            ]
          }}
          transition={{ duration: 6, repeat: Infinity }}
        >
          WHALE Town
        </motion.h1>
      </div>

      <p className="font-mono text-white/50 tracking-widest uppercase mb-5" style={{ fontSize: 'clamp(0.65rem, 1.2vw, 1rem)' }}>
        welcome to whale town.
      </p>

      {/* Meta bar */}
      <div className="flex items-center justify-center flex-wrap mb-6" style={{ gap: 'clamp(0.3rem, 0.5vw, 0.5rem)' }}>
        <span className="rounded-full border border-white/10 bg-white/5 backdrop-blur-md font-mono font-bold tracking-[0.15em] text-white/30 uppercase" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)', padding: 'clamp(4px, 0.5vh, 6px) clamp(10px, 1vw, 16px)' }}>
          Tempo Network
        </span>
        <span className="rounded-full bg-white/20" style={{ width: 'clamp(2px, 0.25vw, 4px)', height: 'clamp(2px, 0.25vw, 4px)' }} />
        <span className="rounded-full border border-dream-cyan/20 bg-dream-cyan/5 backdrop-blur-md font-mono font-bold tracking-[0.15em] text-dream-cyan/70 uppercase" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)', padding: 'clamp(4px, 0.5vh, 6px) clamp(10px, 1vw, 16px)' }}>
          3,333 supply
        </span>
        <span className="rounded-full bg-white/20" style={{ width: 'clamp(2px, 0.25vw, 4px)', height: 'clamp(2px, 0.25vw, 4px)' }} />
        <span className="rounded-full border border-white/10 bg-white/5 backdrop-blur-md font-mono font-bold tracking-[0.15em] text-white/30 uppercase" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)', padding: 'clamp(4px, 0.5vh, 6px) clamp(10px, 1vw, 16px)' }}>
          First Onchain Collection
        </span>
      </div>

      {/* Creature intro */}
      <p className="font-mono text-white/30 tracking-[0.2em] uppercase mb-6" style={{ fontSize: 'clamp(0.5rem, 0.8vw, 0.75rem)' }}>
        sea lions, sharks, and whales, oh my!
      </p>

      {/* Tagline cards */}
      <div className="grid grid-cols-3 mx-auto mb-6" style={{ gap: 'clamp(0.5rem, 1vw, 0.85rem)', maxWidth: 'clamp(20rem, 54vw, 46rem)' }}>
        {taglines.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            whileHover={{ scale: 1.03, y: -3 }}
            className="group relative rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl hover:border-white/20 transition-all duration-500"
            style={{ padding: 'clamp(0.6rem, 1.4vh, 1.1rem) clamp(0.5rem, 0.75vw, 0.85rem)' }}
          >
            <span className="block opacity-60 group-hover:opacity-100 transition-opacity" style={{ fontSize: 'clamp(1.2rem, 2.2vw, 1.8rem)', marginBottom: 'clamp(0.2rem, 0.4vh, 0.4rem)' }}>{item.icon}</span>
            <p className="font-mono text-white/50 tracking-widest uppercase group-hover:text-white/70 transition-colors leading-relaxed" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
              {item.text}
            </p>
          </motion.div>
        ))}
      </div>

      {/* X / Twitter */}
      <div className="flex justify-center" style={{ marginTop: 'clamp(0.8rem, 1.5vh, 1.1rem)' }}>
        <a
          href="https://x.com/whaletowntempo"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/40 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 'clamp(1rem, 1.4vw, 1.25rem)', height: 'clamp(1rem, 1.4vw, 1.25rem)' }}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        </a>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [modalToken, setModalToken] = useState<ModalTokenProps | null>(null);
  const [sweepModeActive, setSweepModeActive] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isConnected, address } = useAccount();

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden">
      <DreamwaveOcean />

      {/* Header */}
      <div className="fixed z-50 flex items-center justify-between w-full" style={{ top: 'clamp(1rem, 3vh, 2.5rem)', left: 0, padding: '0 clamp(1rem, 2vw, 2.5rem)' }}>
        {/* Logo */}
        <Link to="/" className="flex items-center no-underline" style={{ gap: 'clamp(0.4rem, 0.6vw, 0.75rem)' }}>
          <img src="/coralexchange-icon.png" alt="Coral Exchange" className="rounded-lg shadow-md flex-shrink-0" style={{ width: 'clamp(1.25rem, 2vw, 1.75rem)', height: 'clamp(1.25rem, 2vw, 1.75rem)' }} />
          <span className="font-sans font-bold tracking-tight text-dream-white leading-none mt-[2px]" style={{ fontSize: 'clamp(1rem, 1.5vw, 1.6rem)' }}>
            {location.pathname === '/trade' ? (
              <>CORAL<span className="text-dream-cyan opacity-60 ml-0.5">EXCHANGE</span></>
            ) : (
              <>WHALE<span className="text-dream-cyan opacity-60">TOWN</span></>
            )}
          </span>
        </Link>
        {/* Wallet */}
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </div>

      {/* Main Content */}
      <main className="relative z-10 w-full flex flex-col items-center flex-1" style={{ paddingTop: 'clamp(5rem, 10vh, 7rem)', paddingBottom: 'clamp(5rem, 10vh, 7rem)' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="w-full flex flex-col items-center"
            style={{ maxWidth: location.pathname === '/trade' || location.pathname.startsWith('/profile') ? 'clamp(32rem, 80vw, 72rem)' : 'clamp(28rem, 65vw, 52rem)' }}
          >
            {/* Back button */}
            {location.pathname !== '/' && !location.pathname.startsWith('/trade') && (
              <div className="w-full flex" style={{ marginBottom: 'clamp(0.4rem, 0.8vh, 0.6rem)' }}>
                <button
                  onClick={() => navigate(-1)}
                  className="flex items-center justify-center bg-white/5 border border-white/10 rounded-full text-dream-cyan hover:bg-white/10 transition-all cursor-pointer group backdrop-blur-xl"
                  style={{ width: 'clamp(1.75rem, 2.5vw, 2.25rem)', height: 'clamp(1.75rem, 2.5vw, 2.25rem)' }}
                >
                  <ChevronLeft className="group-hover:-translate-x-0.5 transition-transform" style={{ width: 'clamp(0.7rem, 1vw, 0.9rem)', height: 'clamp(0.7rem, 1vw, 0.9rem)' }} />
                </button>
              </div>
            )}
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/staking" element={<StakingPage />} />
              <Route path="/trade" element={<TradePage onSelectToken={setModalToken} onSweepModeChange={setSweepModeActive} />} />
              <Route path="/mint" element={<MintPage onMintSuccess={setModalToken} />} />
              <Route path="/profile" element={<ProfilePage onSelectToken={setModalToken} />} />
              <Route path="/profile/:address" element={<ProfilePage onSelectToken={setModalToken} />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation Buttons — hidden when sweep mode is active */}
      <AnimatePresence>
        {!sweepModeActive && (
          <motion.nav
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed z-50 left-1/2 -translate-x-1/2 flex justify-center items-center bg-[#072436]/40 backdrop-blur-[32px] border border-white/[0.08] shadow-[0_4px_12px_rgba(0,0,0,0.5)] saturate-[1.2]"
            style={{ bottom: 'clamp(0.75rem, 1.5vh, 1.25rem)', gap: 'clamp(0.25rem, 0.5vw, 0.5rem)', padding: 'clamp(0.3rem, 0.5vw, 0.5rem)', borderRadius: '1.25rem' }}
          >
            <RetroButton icon={Home} label="Home" to="/" />
            <RetroButton icon={ArrowLeftRight} label="Trade" to="/trade" />
            <RetroButton icon={Coins} label="Stake" to="/staking" />
            <RetroButton icon={FishingPoleIcon} label="Fish" to="#" disabled />
            <RetroButton icon={User} label="Profile" to={isConnected && address ? `/profile/${address}` : '/profile'} />
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Token Detail Modal */}
      <AnimatePresence>
        {modalToken && <TokenModal token={modalToken} onClose={() => setModalToken(null)} />}
      </AnimatePresence>

      {/* Background fill */}
      <div className="fixed inset-0 -z-10 bg-gradient-radial pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, #164e63 0%, #083344 100%)' }} />
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.05] bg-gradient-to-b from-dream-cyan/10 via-transparent to-dream-purple/10" />
    </div>
  );
}
