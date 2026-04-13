import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  ShoppingBag, 
  Coins, 
  Package, 
  X, 
  ChevronRight,
  Sparkles,
  History,
  Info,
  BookOpen,
  Lock,
  Volume2,
  VolumeX,
  Loader2,
  AlertCircle,
  Anchor,
  Zap,
  Home,
  ArrowLeftRight,
  Fish as FishIcon
} from 'lucide-react';
import { useGameState } from './hooks/useGameState';
import GameScene from './components/GameScene';
import { TACKLE_BOX_COST, TACKLE_BOX_ATTEMPTS, FISH_LIST } from './constants/gameData';
import { soundManager } from './services/soundService';
import DreamwaveOcean from './components/DreamwaveOcean';

export default function App() {
  const {
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
  } = useGameState();

  const [showInventory, setShowInventory] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [isMuted, setIsMuted] = useState(soundManager.isMuted());

  const toggleMute = () => {
    const newMuted = soundManager.toggleMute();
    setIsMuted(newMuted);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center p-4 md:p-8 overflow-x-hidden bg-ocean-deep font-sans selection:bg-dream-cyan/30 text-pearl">
      <DreamwaveOcean />
      
      {/* Background Fill Layers (Whale-Town Match) */}
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(circle at 50% 50%, #164e63 0%, #083344 100%)' }} />
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.05] bg-gradient-to-b from-dream-cyan/10 via-transparent to-dream-purple/10" />

      {/* Header */}
      <header className="fixed z-50 flex items-center justify-between w-full" style={{ top: 'clamp(1rem, 3vh, 2.5rem)', left: 0, padding: '0 clamp(1rem, 2vw, 2.5rem)' }}>
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ rotate: [0, -10, 10, 0] }}
            className="bg-dream-cyan/20 p-2 rounded-lg border border-dream-cyan/30 shadow-lg"
          >
            <FishIcon size={24} className="text-dream-cyan" strokeWidth={2.5} />
          </motion.div>
          <span className="font-sans font-bold text-[clamp(1rem,1.5vw,1.6rem)] tracking-tight text-dream-white leading-none">
            OCEAN<span className="text-dream-cyan opacity-60 ml-0.5 uppercase">Quest</span>
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden sm:flex items-center gap-3 bg-white/[0.03] backdrop-blur-md border border-white/[0.06] px-4 py-2 rounded-xl">
            <Coins size={16} className="text-sun" fill="currentColor" />
            <span className="font-mono text-sm font-bold text-dream-cyan tracking-wider">${(coins/100).toFixed(2)}</span>
          </div>

          <button
            onClick={toggleMute}
            className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white/50 hover:text-white transition-all"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-[10px] font-bold tracking-widest transition-all
              ${walletAddress 
                ? 'bg-white/[0.08] border border-dream-cyan/30 text-dream-cyan shadow-[0_0_15px_rgba(34,211,238,0.15)]' 
                : 'bg-white/[0.05] border border-white/[0.1] text-white hover:bg-white/[0.1]'}
            `}
          >
            {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
            <span>
              {walletAddress 
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` 
                : isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 w-full flex flex-col items-center flex-1 pt-24 pb-32" style={{ maxWidth: 'clamp(28rem, 65vw, 52rem)' }}>
        
        {/* Game Stage */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full relative rounded-3xl border border-white/[0.08] overflow-hidden mb-8 shadow-[0_32px_64px_rgba(0,0,0,0.5)]"
          style={{
            background: 'rgba(10,10,14,0.85)',
            backdropFilter: 'blur(32px)',
          }}
        >
          {/* Top Glow Line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-dream-cyan/40 to-transparent" />
          
          <div className="p-4 md:p-6">
            <div className="rounded-2xl overflow-hidden bg-black/20 border border-white/5">
              <GameScene 
                onCatch={addFish} 
                useAttempt={useAttempt} 
                attempts={attempts} 
              />
            </div>
          </div>

          {/* Attempts HUD */}
          <div className="absolute top-8 right-8">
            <div className="bg-dream-cyan/10 backdrop-blur-md text-dream-cyan border border-dream-cyan/20 px-4 py-1.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg">
              <Zap size={12} fill="currentColor" className="animate-pulse" />
              {attempts} Casts Left
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 w-full mb-12">
           {[
             { label: 'Net', val: `${inventory.length} caught`, icon: Package, color: 'text-dream-cyan' },
             { label: 'Coins', val: coins, icon: Coins, color: 'text-sun' },
             { label: 'Journal', val: `${discoveredFishIds.length}/${FISH_LIST.length}`, icon: BookOpen, color: 'text-dream-purple' }
           ].map((s, i) => (
             <div key={i} className="bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-2xl px-5 py-4 flex-1 group hover:border-white/20 transition-all cursor-default">
                <div className="flex items-center gap-2 mb-2">
                   <s.icon size={14} className={`${s.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
                   <span className="font-mono text-[10px] text-white/30 uppercase tracking-[0.15em] font-bold">{s.label}</span>
                </div>
                <div className="font-bold text-white text-lg tracking-tight">{s.val}</div>
             </div>
           ))}
        </div>

        {/* Secret Dev Controls (Whale-Town doesn't show these but we keep them accessible) */}
        <div className="flex gap-2 mb-8 opacity-20 hover:opacity-100 transition-opacity">
           <button onClick={grantTestResources} className="px-3 py-1.5 rounded-lg border border-white/10 text-[9px] font-mono font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-white/5">
              <Sparkles size={10} /> Grant Resources
           </button>
        </div>
      </main>

      {/* Navigation - Whale-Town Master Nav */}
      <nav className="fixed z-50 left-1/2 -translate-x-1/2 flex justify-center items-center bg-[#072436]/40 backdrop-blur-[32px] border border-white/[0.08] shadow-[0_4px_12px_rgba(0,0,0,0.5)] saturate-[1.2]"
           style={{ bottom: 'clamp(0.75rem, 1.5vh, 1.25rem)', gap: 'clamp(0.25rem, 0.5vw, 0.5rem)', padding: 'clamp(0.3rem, 0.5vw, 0.5rem)', borderRadius: '1.25rem' }}>
         
         <RetroButton 
           icon={Home} 
           label="Home" 
           active={!showInventory && !showShop && !showGallery}
           onClick={() => { setShowInventory(false); setShowShop(false); setShowGallery(false); }} 
         />
         
         <RetroButton 
           icon={Package} 
           label="Net" 
           active={showInventory}
           onClick={() => { setShowInventory(true); setShowShop(false); setShowGallery(false); }} 
         />

         <RetroButton 
           icon={ShoppingBag} 
           label="Shop" 
           active={showShop}
           onClick={() => { setShowInventory(false); setShowShop(true); setShowGallery(false); }} 
         />

         <RetroButton 
           icon={BookOpen} 
           label="Journal" 
           active={showGallery}
           onClick={() => { setShowInventory(false); setShowShop(false); setShowGallery(true); }} 
         />

         <RetroButton 
           icon={User} 
           label="Vault" 
           onClick={() => alert("Vault integration coming soon!")} 
         />
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {showInventory && (
          <ModalOverlay onClose={() => setShowInventory(false)}>
            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Your Catch</h2>
                <p className="text-xs font-mono text-white/30 uppercase tracking-widest mt-1">Total {inventory.length} items in net</p>
              </div>
              <button onClick={() => setShowInventory(false)} className="p-2 hover:bg-white/10 rounded-full text-white/30 transition-all"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
              {inventory.length === 0 ? (
                <div className="py-20 text-center opacity-20">
                  <History size={48} className="mx-auto mb-4" />
                  <p className="font-mono text-xs uppercase tracking-widest">Empty Net</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {inventory.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all">
                      <div className="flex items-center gap-4">
                        <div className="text-3xl bg-white/5 w-14 h-14 rounded-xl flex items-center justify-center border border-white/5">{item.icon}</div>
                        <div>
                          <p className="font-bold text-white leading-tight">{item.name}</p>
                          <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 inline-block ${item.rarity === 'NFT' ? 'text-dream-purple bg-dream-purple/10 border border-dream-purple/20' : 'text-dream-cyan bg-dream-cyan/10 border border-dream-cyan/20'}`}>
                            {item.rarity === 'NFT' ? `${item.nftTier} NFT` : item.rarity}
                          </span>
                        </div>
                      </div>
                      {item.rarity !== 'NFT' ? (
                        <button onClick={() => sellFish(item.id)} className="bg-dream-cyan/10 text-dream-cyan hover:bg-dream-cyan/20 border border-dream-cyan/20 px-4 py-2 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2">
                          <Coins size={12} fill="currentColor" /> SELL {item.value}
                        </button>
                      ) : (
                        <button className="bg-dream-purple text-white hover:bg-dream-purple/80 px-4 py-2 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-dream-purple/20">
                          CLAIM NFT
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ModalOverlay>
        )}

        {showShop && (
          <ModalOverlay onClose={() => setShowShop(false)} maxWidth="max-w-md">
            <div className="p-8 text-center border-b border-white/10 bg-white/[0.02]">
              <div className="w-20 h-20 bg-dream-cyan/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-dream-cyan/20">
                <ShoppingBag className="text-dream-cyan" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Tackle Shop</h2>
              <p className="text-xs font-mono text-white/30 uppercase tracking-widest mt-1">Upgrade your expedition supply</p>
            </div>
            <div className="p-8">
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 mb-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 text-dream-cyan"><Package size={20} /></div>
                    <div>
                      <p className="text-xs font-mono font-bold uppercase text-white/40">Item</p>
                      <p className="font-bold text-white tracking-tight">Supply Pack</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-dream-cyan font-bold uppercase">+{TACKLE_BOX_ATTEMPTS} Casts</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1 text-sun">
                      <Coins size={12} fill="currentColor" />
                      <span className="font-mono text-sm font-bold">{TACKLE_BOX_COST}</span>
                    </div>
                  </div>
                </div>
                <button
                  disabled={hasPurchasedTackleBox || coins < TACKLE_BOX_COST}
                  onClick={() => { if (buyTackleBox()) setShowShop(false); }}
                  className={`w-full py-4 rounded-xl font-mono text-xs font-bold uppercase tracking-widest transition-all ${
                    hasPurchasedTackleBox ? 'bg-white/5 text-white/20 cursor-not-allowed' :
                    coins >= TACKLE_BOX_COST ? 'bg-dream-cyan text-[#0a0a0c] hover:scale-[1.02] shadow-lg shadow-dream-cyan/20' :
                    'bg-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  {hasPurchasedTackleBox ? 'SOLD OUT' : 'BUY NOW'}
                </button>
              </div>
              <button onClick={() => setShowShop(false)} className="w-full font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/20 hover:text-white/50 transition-colors">Close Terminal</button>
            </div>
          </ModalOverlay>
        )}

        {showGallery && (
          <ModalOverlay onClose={() => setShowGallery(false)} maxWidth="max-w-4xl">
            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Discovery Journal</h2>
                <p className="text-xs font-mono text-white/30 uppercase tracking-widest mt-1">Finding rare species in WhaleTown</p>
              </div>
              <button onClick={() => setShowGallery(false)} className="p-2 hover:bg-white/10 rounded-full text-white/30 transition-all"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {FISH_LIST.map((fish) => {
                  const isFound = discoveredFishIds.includes(fish.id);
                  return (
                    <div key={fish.id} className={`rounded-xl p-4 border transition-all text-center ${isFound ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-black/20 border-white/5 opacity-40 grayscale'}`}>
                      <div className="text-4xl mb-3 h-16 w-16 bg-white/5 rounded-lg flex items-center justify-center mx-auto border border-white/5">{isFound ? fish.icon : '❓'}</div>
                      <p className="text-[11px] font-bold text-white/90 truncate mb-1">{isFound ? fish.name : 'Unknown'}</p>
                      {isFound && <span className={`text-[8px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-dream-cyan/10 text-dream-cyan`}>{fish.rarity}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Helper Components matching Whale-Town patterns ---

function RetroButton({ icon: Icon, label, onClick, active, disabled }: any) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`relative group flex flex-col items-center justify-center rounded-xl border transition-all duration-300 ${
        active
          ? 'border-dream-cyan/40 bg-white/[0.08] backdrop-blur-xl shadow-[0_0_15px_rgba(34,211,238,0.15)]'
          : disabled ? 'opacity-40 cursor-not-allowed border-transparent bg-transparent' : 'border-transparent bg-transparent hover:bg-white/[0.04]'
      }`}
      style={{ width: 'clamp(3.5rem, 6vw, 6rem)', height: 'clamp(3.5rem, 6vw, 6rem)' }}
      whileHover={disabled ? {} : { scale: 1.05, y: -2 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
    >
      <Icon className={`mb-1 z-10 transition-colors duration-300 ${active ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`} style={{ width: 'clamp(1.1rem, 1.5vw, 1.25rem)', height: 'clamp(1.1rem, 1.5vw, 1.25rem)' }} />
      <span className={`font-mono font-bold tracking-[0.15em] uppercase z-10 transition-colors duration-300 ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`} style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
        {label}
      </span>
    </motion.button>
  );
}

function ModalOverlay({ children, onClose, maxWidth = "max-w-2xl" }: any) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`relative z-10 w-full ${maxWidth} bg-[#111113] border border-white/[0.08] rounded-[1.5rem] shadow-2xl overflow-hidden`}
      >
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-dream-cyan/30 to-transparent" />
        {children}
      </motion.div>
    </div>
  );
}
