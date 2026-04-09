import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Coins, Music, Play, Pause, SkipBack, SkipForward, Waves, Search, Image as ImageIcon, Skull, ChevronLeft, Sparkles, Minus, Plus, Loader2, X } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import {
  readTotalSupply, readMaxSupply, readMintPrice,
  readIsPublicMintActive, readMaxPerAddress,
  readTokenURI, decodeTokenURI, waitForTransaction,
  contractAddress, contractAbi,
  type TokenMetadata,
} from './contract';

// --- Components ---

const TokenModal = ({ token, onClose }: { token: (TokenMetadata & { id: number }) | null; onClose: () => void }) => {
  if (!token) return null;
  const animalType = token.attributes.find(a => a.trait_type === 'Animal Type')?.value || '';
  const traits = token.attributes.filter(a => a.trait_type !== 'Animal Type' && a.value !== 'None');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="relative z-10 border border-white/15 bg-ocean-deep/95 backdrop-blur-2xl flex"
        style={{ maxHeight: 'clamp(20rem, 65vh, 32rem)', width: 'clamp(20rem, 42vw, 36rem)', borderRadius: 'clamp(1rem, 1.5vw, 1.5rem)', padding: 'clamp(0.75rem, 1.2vw, 1rem)' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute z-20 flex items-center justify-center bg-white/10 border border-white/10 rounded-full text-white/60 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
          style={{ top: 'clamp(0.4rem, 0.7vw, 0.6rem)', right: 'clamp(0.4rem, 0.7vw, 0.6rem)', width: 'clamp(1.25rem, 1.8vw, 1.5rem)', height: 'clamp(1.25rem, 1.8vw, 1.5rem)' }}
        >
          <X style={{ width: 'clamp(0.5rem, 0.7vw, 0.65rem)', height: 'clamp(0.5rem, 0.7vw, 0.65rem)' }} />
        </button>

        {/* Image - left side */}
        <div className="overflow-hidden bg-ocean-deep/80 border border-white/5 flex-shrink-0" style={{ borderRadius: 'clamp(0.5rem, 0.8vw, 0.75rem)', width: '45%', aspectRatio: '1/1' }}>
          <img
            src={token.image_data}
            alt={token.name}
            className="w-full h-full object-cover"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Info - right side */}
        <div className="flex flex-col flex-1 min-w-0" style={{ paddingLeft: 'clamp(0.6rem, 1vw, 0.9rem)' }}>
          <h3 className="font-bold font-sans text-dream-white" style={{ fontSize: 'clamp(0.65rem, 1vw, 0.9rem)', marginBottom: 'clamp(0.1rem, 0.2vh, 0.15rem)' }}>{token.name}</h3>
          <span className="font-mono text-dream-cyan/60 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(5px, 0.5vw, 7px)', marginBottom: 'clamp(0.5rem, 1vh, 0.75rem)' }}>{animalType}</span>

          {traits.length > 0 && (
            <div className="grid grid-cols-2 overflow-y-auto" style={{ gap: 'clamp(0.2rem, 0.4vw, 0.3rem)' }}>
              {traits.map(attr => (
                <div
                  key={attr.trait_type}
                  className="border border-white/10 bg-white/5"
                  style={{ borderRadius: 'clamp(0.25rem, 0.4vw, 0.4rem)', padding: 'clamp(0.2rem, 0.4vw, 0.3rem) clamp(0.3rem, 0.5vw, 0.4rem)' }}
                >
                  <div className="font-mono text-white/30 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(4px, 0.35vw, 5px)', marginBottom: '1px' }}>{attr.trait_type}</div>
                  <div className="font-mono text-dream-white truncate" style={{ fontSize: 'clamp(5px, 0.5vw, 7px)' }}>{attr.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const Whale = () => {
  return (
    <motion.div
      className="fixed z-20 pointer-events-none opacity-40"
      initial={{ x: '-20vw', y: '40vh', rotate: 10 }}
      animate={{ 
        x: '120vw',
        y: ['40vh', '35vh', '45vh', '40vh'],
        rotate: [10, -5, 15, 10]
      }}
      transition={{ 
        duration: 25, 
        repeat: Infinity, 
        ease: "linear" 
      }}
    >
      <svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 30C10 15 40 5 70 5C100 5 115 20 115 35C115 50 90 55 70 55C50 55 10 45 10 30Z" fill="url(#whaleGradient)" />
        <path d="M10 30C10 35 25 45 40 45" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        <path d="M115 35C115 30 105 25 95 25" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        <circle cx="95" cy="20" r="2" fill="white" opacity="0.6" />
        <defs>
          <linearGradient id="whaleGradient" x1="10" y1="30" x2="115" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22d3ee" />
            <stop offset="1" stopColor="#c084fc" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
};

const DreamwaveOcean = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Soft Ethereal Sun */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-b from-dream-blue/20 via-dream-purple/10 to-transparent blur-[100px]" />
      
      {/* Fluid Waves */}
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
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Floating Particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.5
          }}
          animate={{
            y: [0, -100, 0],
            opacity: [0, 0.5, 0]
          }}
          transition={{
            duration: 5 + Math.random() * 5,
            repeat: Infinity,
            delay: Math.random() * 5
          }}
        />
      ))}
    </div>
  );
};

const RetroButton = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => {
  return (
    <motion.button
      onClick={onClick}
      className={`relative group flex flex-col items-center justify-center rounded-xl border transition-all duration-500 overflow-hidden ${
        active
          ? 'border-dream-cyan bg-dream-white/10 backdrop-blur-xl shadow-[0_0_30px_rgba(34,211,238,0.2)]'
          : 'border-white/10 bg-white/5 hover:border-dream-blue/50'
      }`}
      style={{ width: 'clamp(3.5rem, 6vw, 6rem)', height: 'clamp(3.5rem, 6vw, 6rem)' }}
      whileHover={{ scale: 1.05, y: -3 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-dream-cyan/20 to-transparent pointer-events-none"
        animate={{
          y: active ? ["100%", "0%", "100%"] : "100%",
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <Icon className="mb-1 z-10 transition-colors duration-500" style={{ width: 'clamp(1rem, 1.5vw, 1.25rem)', height: 'clamp(1rem, 1.5vw, 1.25rem)' }} />
      <span className={`font-mono font-bold tracking-[0.15em] uppercase z-10 transition-colors duration-500 ${active ? 'text-dream-cyan' : 'text-white/30'}`} style={{ fontSize: 'clamp(6px, 0.6vw, 8px)' }}>
        {label}
      </span>
    </motion.button>
  );
};

const MusicPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress] = useState(35);

  return (
    <div
      className="w-full border border-white/20 bg-white/5 backdrop-blur-2xl shadow-2xl"
      style={{ maxWidth: 'clamp(16rem, 28vw, 24rem)', padding: 'clamp(1rem, 2vw, 1.75rem)', borderRadius: 'clamp(1rem, 1.5vw, 1.5rem)' }}
    >
      <div className="flex items-center" style={{ gap: 'clamp(0.75rem, 1.5vw, 1.25rem)', marginBottom: 'clamp(1rem, 2vh, 1.5rem)' }}>
        <div className="rounded-xl bg-gradient-to-br from-dream-cyan/20 to-dream-purple/20 border border-white/10 flex items-center justify-center relative overflow-hidden group" style={{ width: 'clamp(3.5rem, 6vw, 5rem)', height: 'clamp(3.5rem, 6vw, 5rem)' }}>
          <Waves className="text-dream-cyan animate-pulse" style={{ width: 'clamp(1.5rem, 3vw, 2.5rem)', height: 'clamp(1.5rem, 3vw, 2.5rem)' }} />
        </div>
        <div>
          <h3 className="font-bold text-dream-white font-sans tracking-tight" style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1.1rem)' }}>DREAM WAVES</h3>
          <p className="text-dream-cyan/60 font-mono uppercase tracking-widest" style={{ fontSize: 'clamp(0.4rem, 0.6vw, 0.6rem)' }}>Whale Town FM</p>
          <div className="flex items-center" style={{ marginTop: 'clamp(0.3rem, 0.5vh, 0.5rem)', gap: '2px' }}>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="bg-dream-cyan/50 rounded-full"
                style={{ width: 'clamp(2px, 0.2vw, 3px)' }}
                animate={{ height: isPlaying ? [3, 16, 3] : 3 }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
        <div className="relative bg-white/10 rounded-full overflow-hidden" style={{ height: 'clamp(2px, 0.3vh, 4px)' }}>
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-dream-cyan to-dream-purple"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between font-mono text-white/30 tracking-widest" style={{ fontSize: 'clamp(6px, 0.5vw, 8px)' }}>
          <span>01:24</span>
          <span>03:45</span>
        </div>

        <div className="flex items-center justify-center" style={{ gap: 'clamp(1rem, 2vw, 1.75rem)' }}>
          <button className="text-white/30 hover:text-dream-cyan transition-colors"><SkipBack style={{ width: 'clamp(0.8rem, 1.2vw, 1.1rem)', height: 'clamp(0.8rem, 1.2vw, 1.1rem)' }} /></button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="rounded-full bg-dream-white text-ocean-deep flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
            style={{ width: 'clamp(2rem, 3.5vw, 3rem)', height: 'clamp(2rem, 3.5vw, 3rem)' }}
          >
            {isPlaying ? <Pause fill="currentColor" style={{ width: 'clamp(0.7rem, 1vw, 0.9rem)' }} /> : <Play fill="currentColor" className="ml-0.5" style={{ width: 'clamp(0.7rem, 1vw, 0.9rem)' }} />}
          </button>
          <button className="text-white/30 hover:text-dream-cyan transition-colors"><SkipForward style={{ width: 'clamp(0.8rem, 1.2vw, 1.1rem)', height: 'clamp(0.8rem, 1.2vw, 1.1rem)' }} /></button>
        </div>
      </div>
    </div>
  );
};

const StakingPage = () => {
  return (
    <div
      className="grid grid-cols-2 w-full"
      style={{ gap: 'clamp(0.75rem, 1.5vw, 1.25rem)', maxWidth: 'clamp(24rem, 50vw, 42rem)' }}
    >
      <div className="border border-white/10 bg-white/5 backdrop-blur-xl" style={{ padding: 'clamp(1rem, 2vw, 1.75rem)', borderRadius: 'clamp(1rem, 1.5vw, 1.5rem)' }}>
        <h2 className="font-bold text-dream-cyan font-sans tracking-tight text-left uppercase" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)', marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>STAKING POOL</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
          <div className="flex justify-between items-end border-b border-white/5" style={{ paddingBottom: 'clamp(0.4rem, 0.8vh, 0.6rem)' }}>
            <span className="font-mono text-white/40 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(0.4rem, 0.6vw, 0.6rem)' }}>Total Staked</span>
            <span className="font-bold text-dream-white" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)' }}>1.2M OCEAN</span>
          </div>
          <div className="flex justify-between items-end border-b border-white/5" style={{ paddingBottom: 'clamp(0.4rem, 0.8vh, 0.6rem)' }}>
            <span className="font-mono text-white/40 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(0.4rem, 0.6vw, 0.6rem)' }}>Current APY</span>
            <span className="font-bold text-dream-cyan" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)' }}>42.5%</span>
          </div>
          <button className="w-full bg-dream-cyan text-ocean-deep font-bold font-mono tracking-[0.2em] hover:bg-dream-white transition-colors cursor-pointer" style={{ padding: 'clamp(0.4rem, 0.8vh, 0.6rem)', borderRadius: 'clamp(0.5rem, 0.8vw, 0.75rem)', fontSize: 'clamp(0.5rem, 0.7vw, 0.7rem)' }}>
            STAKE
          </button>
        </div>
      </div>

      <div className="border border-white/10 bg-white/5 backdrop-blur-xl" style={{ padding: 'clamp(1rem, 2vw, 1.75rem)', borderRadius: 'clamp(1rem, 1.5vw, 1.5rem)' }}>
        <h2 className="font-bold text-dream-purple font-sans tracking-tight text-left uppercase" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)', marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>REWARDS</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
          <div className="flex justify-between items-end border-b border-white/5" style={{ paddingBottom: 'clamp(0.4rem, 0.8vh, 0.6rem)' }}>
            <span className="font-mono text-white/40 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(0.4rem, 0.6vw, 0.6rem)' }}>Unclaimed</span>
            <span className="font-bold text-dream-white" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)' }}>452.1 OCEAN</span>
          </div>
          <div className="flex justify-between items-end border-b border-white/5" style={{ paddingBottom: 'clamp(0.4rem, 0.8vh, 0.6rem)' }}>
            <span className="font-mono text-white/40 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(0.4rem, 0.6vw, 0.6rem)' }}>Daily Yield</span>
            <span className="font-bold text-dream-purple" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)' }}>12.4 OCEAN</span>
          </div>
          <button className="w-full border border-dream-purple text-dream-purple font-bold font-mono tracking-[0.2em] hover:bg-dream-purple hover:text-white transition-all cursor-pointer" style={{ padding: 'clamp(0.4rem, 0.8vh, 0.6rem)', borderRadius: 'clamp(0.5rem, 0.8vw, 0.75rem)', fontSize: 'clamp(0.5rem, 0.7vw, 0.7rem)' }}>
            CLAIM
          </button>
        </div>
      </div>
    </div>
  );
};

const GalleryPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tokens, setTokens] = useState<(TokenMetadata & { id: number })[]>([]);
  const [totalMinted, setTotalMinted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedToken, setSelectedToken] = useState<(TokenMetadata & { id: number }) | null>(null);
  const PAGE_SIZE = 6;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const supply = await readTotalSupply();
        const total = Number(supply);
        setTotalMinted(total);
        if (total === 0) { setLoading(false); return; }

        const startId = total - 1 - (page * PAGE_SIZE);
        const endId = Math.max(startId - PAGE_SIZE + 1, 0);
        const ids: number[] = [];
        for (let i = startId; i >= endId; i--) ids.push(i);

        const results = await Promise.all(
          ids.map(async (id) => {
            const uri = await readTokenURI(BigInt(id));
            return { ...decodeTokenURI(uri), id };
          })
        );
        setTokens(results);
      } catch (e) { console.error('Gallery load error', e); }
      setLoading(false);
    }
    load();
  }, [page]);

  const totalPages = Math.ceil(totalMinted / PAGE_SIZE);
  const filtered = tokens.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const animalColor: Record<string, string> = { Sharks: 'text-dream-cyan', Whales: 'text-dream-purple', SeaLions: 'text-dream-blue' };

  return (
    <div
      className="w-full"
      style={{ maxWidth: 'clamp(20rem, 48vw, 40rem)', padding: '0 clamp(0.5rem, 1vw, 1rem)' }}
    >
      <div className="flex justify-between items-center" style={{ gap: 'clamp(0.5rem, 1vw, 1rem)', marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>
        <h2 className="font-bold font-sans text-dream-white tracking-tight uppercase" style={{ fontSize: 'clamp(0.8rem, 1.3vw, 1.2rem)' }}>
          GALLERY
          {totalMinted > 0 && <span className="font-mono text-white/30 font-normal" style={{ fontSize: 'clamp(0.4rem, 0.55vw, 0.5rem)', marginLeft: 'clamp(0.3rem, 0.5vw, 0.5rem)' }}>{totalMinted} MINTED</span>}
        </h2>
        <div className="relative" style={{ width: 'clamp(10rem, 20vw, 18rem)' }}>
          <Search className="absolute top-1/2 -translate-y-1/2 text-white/20" style={{ left: 'clamp(0.5rem, 0.8vw, 0.75rem)', width: 'clamp(0.6rem, 0.8vw, 0.75rem)', height: 'clamp(0.6rem, 0.8vw, 0.75rem)' }} />
          <input
            type="text"
            placeholder="SEARCH..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 font-mono text-dream-white placeholder:text-white/20 focus:border-dream-cyan outline-none transition-all backdrop-blur-md"
            style={{ paddingLeft: 'clamp(1.5rem, 2.5vw, 2rem)', paddingRight: 'clamp(0.5rem, 0.8vw, 0.75rem)', paddingTop: 'clamp(0.3rem, 0.5vh, 0.5rem)', paddingBottom: 'clamp(0.3rem, 0.5vh, 0.5rem)', borderRadius: 'clamp(0.5rem, 0.8vw, 0.75rem)', fontSize: 'clamp(0.4rem, 0.6vw, 0.6rem)' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 'clamp(3rem, 8vh, 5rem)' }}>
          <Loader2 className="animate-spin text-dream-cyan/40" style={{ width: 'clamp(1.5rem, 2.5vw, 2rem)', height: 'clamp(1.5rem, 2.5vw, 2rem)' }} />
        </div>
      ) : totalMinted === 0 ? (
        <div className="text-center" style={{ padding: 'clamp(3rem, 8vh, 5rem)' }}>
          <ImageIcon className="text-white/10 mx-auto" style={{ width: 'clamp(2rem, 4vw, 3rem)', height: 'clamp(2rem, 4vw, 3rem)' }} />
          <p className="font-mono text-white/30 tracking-widest uppercase" style={{ fontSize: 'clamp(0.4rem, 0.6vw, 0.55rem)', marginTop: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
            NO TOKENS MINTED YET
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3" style={{ gap: 'clamp(0.5rem, 1vw, 0.75rem)' }}>
            <AnimatePresence mode="popLayout">
              {filtered.map((token) => {
                const animalType = token.attributes.find(a => a.trait_type === 'Animal Type')?.value || '';
                return (
                  <motion.div
                    key={token.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative border border-white/10 bg-white/5 backdrop-blur-xl hover:border-white/30 transition-all duration-500 cursor-pointer"
                    style={{ padding: 'clamp(0.4rem, 0.8vw, 0.7rem)', borderRadius: 'clamp(0.75rem, 1.2vw, 1.1rem)' }}
                    onClick={() => setSelectedToken(token)}
                  >
                    <div className="overflow-hidden relative bg-ocean-deep/50" style={{ borderRadius: 'clamp(0.5rem, 0.8vw, 0.75rem)', marginBottom: 'clamp(0.3rem, 0.5vh, 0.5rem)', aspectRatio: '1/1' }}>
                      <img
                        src={token.image_data}
                        alt={token.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <h3 className="font-bold font-sans text-dream-white truncate" style={{ fontSize: 'clamp(0.5rem, 0.75vw, 0.7rem)', marginBottom: 'clamp(0.05rem, 0.1vh, 0.1rem)' }}>{token.name}</h3>
                    <span className={`font-mono uppercase tracking-[0.15em] ${animalColor[animalType] || 'text-white/40'}`} style={{ fontSize: 'clamp(4px, 0.45vw, 6px)' }}>
                      {animalType}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center" style={{ gap: 'clamp(0.5rem, 1vw, 0.75rem)', marginTop: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="font-mono font-bold tracking-[0.15em] text-white/40 border border-white/10 bg-white/5 hover:border-dream-cyan/30 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ fontSize: 'clamp(5px, 0.5vw, 7px)', padding: 'clamp(2px, 0.3vh, 4px) clamp(6px, 0.8vw, 10px)', borderRadius: 'clamp(0.3rem, 0.5vw, 0.4rem)' }}
              >
                PREV
              </button>
              <span className="font-mono text-white/30" style={{ fontSize: 'clamp(5px, 0.5vw, 7px)' }}>{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="font-mono font-bold tracking-[0.15em] text-white/40 border border-white/10 bg-white/5 hover:border-dream-cyan/30 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ fontSize: 'clamp(5px, 0.5vw, 7px)', padding: 'clamp(2px, 0.3vh, 4px) clamp(6px, 0.8vw, 10px)', borderRadius: 'clamp(0.3rem, 0.5vw, 0.4rem)' }}
              >
                NEXT
              </button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {selectedToken && <TokenModal token={selectedToken} onClose={() => setSelectedToken(null)} />}
      </AnimatePresence>
    </div>
  );
};

const MintPage = () => {
  const { address: walletAddress, isConnected } = useAccount();
  const { writeContract, data: txHash, isPending: isTxPending, error: txError, reset: resetTx } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const [totalSupply, setTotalSupply] = useState(0);
  const [maxSupply, setMaxSupply] = useState(3333);
  const [mintPrice, setMintPrice] = useState(0n);
  const [isActive, setIsActive] = useState(false);
  const [maxPerAddr, setMaxPerAddr] = useState(20);
  const [mintCount, setMintCount] = useState(1);
  const [mintedToken, setMintedToken] = useState<(TokenMetadata & { id: number }) | null>(null);

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
        // Fetch the last minted token to show in modal
        try {
          const lastId = newSupply - 1;
          const uri = await readTokenURI(BigInt(lastId));
          setMintedToken({ ...decodeTokenURI(uri), id: lastId });
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
      className="w-full border border-white/10 bg-white/5 backdrop-blur-xl mx-auto"
      style={{ maxWidth: 'clamp(18rem, 34vw, 28rem)', padding: 'clamp(1.25rem, 2.5vw, 2rem)', borderRadius: 'clamp(1rem, 1.5vw, 1.5rem)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center" style={{ marginBottom: 'clamp(1rem, 2vh, 1.5rem)' }}>
        <h2 className="font-bold text-dream-cyan font-sans tracking-tight uppercase" style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.1rem)' }}>MINT</h2>
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
            if (!mounted) return null;
            if (!account) return (
              <button onClick={openConnectModal} className="font-mono font-bold tracking-[0.1em] text-dream-cyan border border-dream-cyan/30 bg-dream-cyan/5 hover:bg-dream-cyan/10 transition-colors cursor-pointer" style={{ fontSize: 'clamp(5px, 0.55vw, 8px)', padding: 'clamp(2px, 0.3vh, 4px) clamp(6px, 0.8vw, 10px)', borderRadius: 'clamp(0.3rem, 0.5vw, 0.5rem)' }}>
                CONNECT
              </button>
            );
            if (chain?.unsupported) return (
              <button onClick={openChainModal} className="font-mono font-bold tracking-[0.1em] text-red-400 border border-red-400/30 bg-red-400/5 cursor-pointer" style={{ fontSize: 'clamp(5px, 0.55vw, 8px)', padding: 'clamp(2px, 0.3vh, 4px) clamp(6px, 0.8vw, 10px)', borderRadius: 'clamp(0.3rem, 0.5vw, 0.5rem)' }}>
                WRONG NETWORK
              </button>
            );
            return (
              <button onClick={openAccountModal} className="font-mono font-bold tracking-[0.1em] text-white/40 border border-white/10 bg-white/5 hover:border-dream-cyan/30 transition-colors cursor-pointer" style={{ fontSize: 'clamp(5px, 0.55vw, 8px)', padding: 'clamp(2px, 0.3vh, 4px) clamp(6px, 0.8vw, 10px)', borderRadius: 'clamp(0.3rem, 0.5vw, 0.5rem)' }}>
                {account.displayName}
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>

      {/* Supply */}
      <div style={{ marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>
        <div className="flex justify-between items-end" style={{ marginBottom: 'clamp(0.25rem, 0.4vh, 0.35rem)' }}>
          <span className="font-mono text-white/40 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(0.4rem, 0.55vw, 0.55rem)' }}>Supply</span>
          <span className="font-bold text-dream-white" style={{ fontSize: 'clamp(0.6rem, 0.9vw, 0.85rem)' }}>{totalSupply} / {maxSupply}</span>
        </div>
        <div className="w-full bg-white/10 rounded-full overflow-hidden" style={{ height: 'clamp(3px, 0.4vh, 5px)' }}>
          <div className="h-full bg-gradient-to-r from-dream-cyan to-dream-purple transition-all duration-500" style={{ width: `${supplyPct}%` }} />
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center" style={{ gap: 'clamp(0.3rem, 0.4vw, 0.4rem)', marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>
        <div className="rounded-full" style={{ width: 'clamp(4px, 0.4vw, 6px)', height: 'clamp(4px, 0.4vw, 6px)', background: isActive ? '#22c55e' : '#ef4444' }} />
        <span className="font-mono uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(0.35rem, 0.5vw, 0.5rem)', color: isActive ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)' }}>
          {isActive ? 'PUBLIC MINT ACTIVE' : 'MINT PAUSED'}
        </span>
        <span className="font-mono text-white/20" style={{ fontSize: 'clamp(0.35rem, 0.5vw, 0.5rem)' }}>|</span>
        <span className="font-mono text-dream-cyan/60 uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(0.35rem, 0.5vw, 0.5rem)' }}>
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
          fontSize: 'clamp(0.5rem, 0.7vw, 0.65rem)',
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
        <p className="font-mono text-center" style={{ fontSize: 'clamp(5px, 0.5vw, 7px)', color: 'rgba(239,68,68,0.7)', marginTop: 'clamp(0.3rem, 0.5vh, 0.5rem)' }}>
          {(txError as any)?.shortMessage || txError.message}
        </p>
      )}

      <AnimatePresence>
        {mintedToken && <TokenModal token={mintedToken} onClose={() => setMintedToken(null)} />}
      </AnimatePresence>
    </div>
  );
};

const HomePage = () => {
  const taglines = [
    { text: "it pays to be a whale.", icon: "🐋" },
    { text: "beware of sharks.", icon: "🦈" },
    { text: "everybody loves a sea lion.", icon: "🦭" },
  ];

  return (
    <div
      className="text-center w-full mx-auto"
      style={{ maxWidth: 'clamp(20rem, 60vw, 50rem)' }}
    >
      {/* Hero */}
      <div className="relative inline-block" style={{ marginBottom: 'clamp(0.25rem, 0.5vh, 0.5rem)' }}>
        <motion.h1
          className="font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-dream-white via-dream-cyan to-dream-purple"
          style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)' }}
          animate={{
            filter: [
              "drop-shadow(0 0 20px rgba(34,211,238,0.2))",
              "drop-shadow(0 0 40px rgba(192,132,252,0.2))",
              "drop-shadow(0 0 20px rgba(34,211,238,0.2))"
            ]
          }}
          transition={{ duration: 6, repeat: Infinity }}
        >
          WHALE Town.
        </motion.h1>
      </div>

      <p className="font-mono text-white/50 tracking-widest uppercase" style={{ fontSize: 'clamp(0.55rem, 1vw, 0.85rem)', marginBottom: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
        welcome to whale town.
      </p>

      {/* Meta bar */}
      <div className="flex items-center justify-center flex-wrap" style={{ gap: 'clamp(0.3rem, 0.5vw, 0.5rem)', marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>
        <span className="rounded-full border border-white/10 bg-white/5 backdrop-blur-md font-mono font-bold tracking-[0.15em] text-white/30 uppercase" style={{ fontSize: 'clamp(5px, 0.55vw, 8px)', padding: 'clamp(2px, 0.3vh, 4px) clamp(6px, 0.7vw, 12px)' }}>
          Tempo Network
        </span>
        <span className="rounded-full bg-white/20" style={{ width: 'clamp(2px, 0.25vw, 4px)', height: 'clamp(2px, 0.25vw, 4px)' }} />
        <span className="rounded-full border border-dream-cyan/20 bg-dream-cyan/5 backdrop-blur-md font-mono font-bold tracking-[0.15em] text-dream-cyan/70 uppercase" style={{ fontSize: 'clamp(5px, 0.55vw, 8px)', padding: 'clamp(2px, 0.3vh, 4px) clamp(6px, 0.7vw, 12px)' }}>
          3,333 supply
        </span>
        <span className="rounded-full bg-white/20" style={{ width: 'clamp(2px, 0.25vw, 4px)', height: 'clamp(2px, 0.25vw, 4px)' }} />
        <span className="rounded-full border border-white/10 bg-white/5 backdrop-blur-md font-mono font-bold tracking-[0.15em] text-white/30 uppercase" style={{ fontSize: 'clamp(5px, 0.55vw, 8px)', padding: 'clamp(2px, 0.3vh, 4px) clamp(6px, 0.7vw, 12px)' }}>
          First Onchain Collection
        </span>
      </div>

      {/* Creature intro */}
      <p className="font-mono text-white/30 tracking-[0.2em] uppercase" style={{ fontSize: 'clamp(0.4rem, 0.65vw, 0.65rem)', marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>
        sea lions, sharks, and whales.
      </p>

      {/* Tagline cards */}
      <div className="grid grid-cols-3 mx-auto" style={{ gap: 'clamp(0.4rem, 0.8vw, 0.75rem)', marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)', maxWidth: 'clamp(16rem, 45vw, 40rem)' }}>
        {taglines.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            whileHover={{ scale: 1.03, y: -3 }}
            className="group relative rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl hover:border-white/20 transition-all duration-500"
            style={{ padding: 'clamp(0.5rem, 1.2vh, 1rem) clamp(0.4rem, 0.6vw, 0.75rem)' }}
          >
            <span className="block opacity-60 group-hover:opacity-100 transition-opacity" style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)', marginBottom: 'clamp(0.15rem, 0.3vh, 0.35rem)' }}>{item.icon}</span>
            <p className="font-mono text-white/50 tracking-widest uppercase group-hover:text-white/70 transition-colors leading-relaxed" style={{ fontSize: 'clamp(5px, 0.55vw, 8px)' }}>
              {item.text}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Warning */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="inline-flex items-center rounded-lg border border-dream-purple/20 bg-dream-purple/5 backdrop-blur-xl"
        style={{ gap: 'clamp(0.25rem, 0.4vw, 0.5rem)', padding: 'clamp(0.3rem, 0.5vh, 0.5rem) clamp(0.5rem, 1vw, 1rem)' }}
      >
        <Skull className="text-dream-purple/60" style={{ width: 'clamp(0.6rem, 0.8vw, 0.85rem)', height: 'clamp(0.6rem, 0.8vw, 0.85rem)' }} />
        <p className="font-mono text-dream-purple/60 tracking-[0.12em] uppercase" style={{ fontSize: 'clamp(5px, 0.55vw, 8px)' }}>
          don't swim out to deep waters - pirates are approaching.
        </p>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  type TabType = 'home' | 'staking' | 'music' | 'gallery' | 'mint';
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [history, setHistory] = useState<TabType[]>([]);

  const changeTab = (tab: TabType) => {
    if (tab !== activeTab) {
      setHistory(prev => [...prev, activeTab]);
      setActiveTab(tab);
    }
  };

  const goBack = () => {
    if (history.length > 0) {
      const newHistory = [...history];
      const lastTab = newHistory.pop();
      if (lastTab) {
        setHistory(newHistory);
        setActiveTab(lastTab);
      }
    } else if (activeTab !== 'home') {
      setActiveTab('home');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden">
      <DreamwaveOcean />
      <Whale />

      {/* Header / Logo */}
      <div className="fixed z-50 flex items-center" style={{ top: 'clamp(1rem, 3vh, 2.5rem)', left: 'clamp(1rem, 2vw, 2.5rem)', gap: 'clamp(0.4rem, 0.6vw, 0.75rem)' }}>
        <div className="bg-gradient-to-br from-dream-cyan to-dream-purple rounded-lg blur-[2px] animate-pulse" style={{ width: 'clamp(1.5rem, 2.5vw, 2.25rem)', height: 'clamp(1.5rem, 2.5vw, 2.25rem)' }} />
        <span className="font-sans font-bold tracking-tight text-dream-white" style={{ fontSize: 'clamp(0.9rem, 1.3vw, 1.4rem)' }}>WHALE<span className="text-dream-cyan opacity-60">TOWN</span></span>
      </div>

      {/* Main Content */}
      <main className="relative z-10 w-full flex flex-col items-center justify-center flex-1" style={{ paddingTop: 'clamp(3rem, 7vh, 4.5rem)', paddingBottom: 'clamp(4rem, 9vh, 6rem)' }}>
        {/* Back button - floats above content on non-home pages */}
        <AnimatePresence>
          {activeTab !== 'home' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="w-full flex"
              style={{ maxWidth: activeTab === 'staking' ? 'clamp(24rem, 50vw, 42rem)' : activeTab === 'gallery' ? 'clamp(20rem, 48vw, 40rem)' : 'clamp(18rem, 34vw, 28rem)', marginBottom: 'clamp(0.3rem, 0.6vh, 0.5rem)' }}
            >
              <button
                onClick={goBack}
                className="flex items-center justify-center bg-white/5 border border-white/10 rounded-full text-dream-cyan hover:bg-white/10 transition-all cursor-pointer group backdrop-blur-xl"
                style={{ width: 'clamp(1.5rem, 2.2vw, 2rem)', height: 'clamp(1.5rem, 2.2vw, 2rem)' }}
              >
                <ChevronLeft className="group-hover:-translate-x-0.5 transition-transform" style={{ width: 'clamp(0.6rem, 0.9vw, 0.8rem)', height: 'clamp(0.6rem, 0.9vw, 0.8rem)' }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="w-full flex flex-col items-center"
          >
            {activeTab === 'home' && <HomePage />}
            {activeTab === 'staking' && <StakingPage />}
            {activeTab === 'gallery' && <GalleryPage />}
            {activeTab === 'mint' && <MintPage />}
            {activeTab === 'music' && (
              <div className="flex flex-col items-center" style={{ gap: 'clamp(0.75rem, 2vh, 1.5rem)' }}>
                <h2 className="font-bold font-sans text-dream-white tracking-tight uppercase" style={{ fontSize: 'clamp(1rem, 2vw, 1.75rem)' }}>PLAYER</h2>
                <MusicPlayer />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation Buttons */}
      <nav className="fixed z-50 left-1/2 -translate-x-1/2 flex justify-center items-center bg-white/5 backdrop-blur-xl border border-white/10" style={{ bottom: 'clamp(0.75rem, 1.5vh, 1.25rem)', gap: 'clamp(0.25rem, 0.5vw, 0.5rem)', padding: 'clamp(0.3rem, 0.5vw, 0.5rem)', borderRadius: 'clamp(0.75rem, 1.2vw, 1.1rem)' }}>
        <RetroButton icon={Home} label="Home" active={activeTab === 'home'} onClick={() => changeTab('home')} />
        <RetroButton icon={Sparkles} label="Mint" active={activeTab === 'mint'} onClick={() => changeTab('mint')} />
        <RetroButton icon={ImageIcon} label="Gallery" active={activeTab === 'gallery'} onClick={() => changeTab('gallery')} />
        <RetroButton icon={Coins} label="Staking" active={activeTab === 'staking'} onClick={() => changeTab('staking')} />
        <RetroButton icon={Music} label="Music" active={activeTab === 'music'} onClick={() => changeTab('music')} />
      </nav>

      {/* Background fill */}
      <div className="fixed inset-0 -z-10 bg-gradient-radial pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, #164e63 0%, #083344 100%)' }} />
      {/* Dreamwave Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.05] bg-gradient-to-b from-dream-cyan/10 via-transparent to-dream-purple/10" />
    </div>
  );
}
