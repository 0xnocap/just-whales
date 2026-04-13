import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FISH_LIST } from '../constants/gameData';
import { Fish, Sparkles, AlertCircle, Waves as WavesIcon, Zap, Frown, Ghost, Trash2, Anchor } from 'lucide-react';
import { soundManager } from '../services/soundService';

const NO_BITE_MESSAGES = [
  "The fish are having a meeting about your bait. It's not going well.",
  "So sorry! The fish decided to go vegan today.",
  "A fish looked at your hook and just laughed. I saw it.",
  "The fish are currently on their lunch break. Try again later?",
  "You're doing great! The fish are just being shy.",
  "Maybe try singing to them? Fish love a good sea shanty.",
  "The fish said your bait is 'so last season'.",
  "Ouch. Even the seaweed ignored you.",
  "The fish are busy watching 'Finding Nemo' for the 100th time.",
  "They're not biting, but they're definitely judging your technique.",
  "A crab just used your hook as a back scratcher and left.",
  "The fish are playing hide and seek. You're 'it' forever.",
  "Your bait looks like it's from a budget grocery store.",
  "The fish are holding a protest against hooks. Very organized.",
  "I think you accidentally used a gummy worm. They know.",
  "The fish are currently attending a 'How to avoid hooks' seminar.",
  "A seagull just told the fish where you are. Snitch.",
  "The fish are waiting for a better offer. Try adding some gold?",
  "Your fishing rod is upside down. Just kidding, but still no fish.",
  "The fish are actually all at a party. You weren't invited."
];

function FishModel({ fish }: { fish: any }) {
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Background Glow */}
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className={`absolute inset-0 rounded-full blur-3xl ${fish.color.replace('text-', 'bg-')}/20`}
      />
      
      {/* Water Ripples/Bubbles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 1.5],
            opacity: [0.5, 0],
            y: [0, -40 - Math.random() * 40],
            x: [0, (Math.random() - 0.5) * 60]
          }}
          transition={{ 
            duration: 1 + Math.random(),
            repeat: Infinity,
            delay: i * 0.2
          }}
          className="absolute w-2 h-2 bg-blue-200/40 rounded-full"
        />
      ))}

      {/* Main Fish Body Container */}
      <motion.div
        animate={{ 
          y: [0, -10, 0],
          rotate: [-5, 5, -5],
          scale: [1, 1.05, 1]
        }}
        transition={{ 
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="relative z-10"
      >
        {/* Shadow Layer */}
        <div className={`absolute inset-0 blur-md translate-y-4 opacity-30 text-8xl flex items-center justify-center`}>
          {fish.icon}
        </div>

        {/* Main Body */}
        <motion.div
          animate={{ 
            rotateY: [0, 15, 0, -15, 0]
          }}
          transition={{ 
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="text-8xl drop-shadow-2xl flex items-center justify-center"
        >
          {fish.icon}
        </motion.div>
      </motion.div>

      {/* Rarity Sparkles for high rarity */}
      {(fish.rarity === 'Legendary' || fish.rarity === 'NFT' || fish.rarity === 'Epic') && (
        <div className="absolute inset-0">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
                rotate: [0, 180]
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2
              }}
              className="absolute"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`
              }}
            >
              <Sparkles size={16} className="text-yellow-400" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

interface GameSceneProps {
  onCatch: (fish: any) => void;
  useAttempt: () => boolean;
  attempts: number;
}

export default function GameScene({ onCatch, useAttempt, attempts }: GameSceneProps) {
  const [gameState, setGameState] = useState<'idle' | 'casting' | 'waiting' | 'bite' | 'result'>('idle');
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<string>('');

  const handleCast = () => {
    if (gameState !== 'idle') return;
    
    if (attempts <= 0) {
      setMessage("No attempts left today!");
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (!useAttempt()) return;

    soundManager.play('cast');
    setGameState('casting');
    
    // Animation sequence
    setTimeout(() => {
      setGameState('waiting');
      
      // Random wait for bite
      const waitTime = 2000 + Math.random() * 3000;
      setTimeout(() => {
        const isBite = Math.random() > 0.5; // 50% chance of bite (was 70%)
        
        if (isBite) {
          soundManager.play('bite');
          setGameState('bite');
          // Wait for user to "react" or just auto-resolve for simplicity as requested
          setTimeout(() => {
            resolveCatch();
          }, 1500);
        } else {
          setGameState('result');
          setResult(null);
          const randomMessage = NO_BITE_MESSAGES[Math.floor(Math.random() * NO_BITE_MESSAGES.length)];
          setMessage(randomMessage);
          setTimeout(() => {
            setGameState('idle');
            setMessage('');
          }, 4000);
        }
      }, waitTime);
    }, 1000);
  };

  const resolveCatch = () => {
    const roll = Math.random() * 100;
    let caughtFish;

    if (roll > 99) { // 1% chance for NFT (was 2%)
      const nfts = FISH_LIST.filter(f => f.rarity === 'NFT');
      // Within NFTs, make Legendary/Ultra rarer
      const nftRoll = Math.random() * 100;
      if (nftRoll > 95) { // 5% chance for Legendary NFT
        caughtFish = nfts.find(n => n.nftTier === 'Legendary');
      } else if (nftRoll > 80) { // 15% chance for Ultra Rare NFT
        caughtFish = nfts.find(n => n.nftTier === 'Ultra Rare');
      } else if (nftRoll > 50) { // 30% chance for Rare NFT
        caughtFish = nfts.find(n => n.nftTier === 'Rare');
      } else { // 50% chance for Common NFT
        caughtFish = nfts.find(n => n.nftTier === 'Common');
      }
      // Fallback if specific tier not found (shouldn't happen with current list)
      if (!caughtFish) caughtFish = nfts[Math.floor(Math.random() * nfts.length)];
    } else if (roll > 96) { // 3% chance for Legendary (was 5%)
      const legendaries = FISH_LIST.filter(f => f.rarity === 'Legendary');
      caughtFish = legendaries[Math.floor(Math.random() * legendaries.length)];
    } else if (roll > 90) { // 6% chance for Epic (was 10%)
      const epics = FISH_LIST.filter(f => f.rarity === 'Epic');
      caughtFish = epics[Math.floor(Math.random() * epics.length)];
    } else if (roll > 80) { // 10% chance for Rare (was 15%)
      const rares = FISH_LIST.filter(f => f.rarity === 'Rare');
      caughtFish = rares[Math.floor(Math.random() * rares.length)];
    } else if (roll > 65) { // 15% chance for Uncommon (was 20%)
      const uncommons = FISH_LIST.filter(f => f.rarity === 'Uncommon');
      caughtFish = uncommons[Math.floor(Math.random() * uncommons.length)];
    } else if (roll > 35) { // 30% chance for Junk (was 20%)
      const junks = FISH_LIST.filter(f => f.rarity === 'Junk');
      caughtFish = junks[Math.floor(Math.random() * junks.length)];
    } else { // 35% chance for Common (was 28%)
      const commons = FISH_LIST.filter(f => f.rarity === 'Common');
      caughtFish = commons[Math.floor(Math.random() * commons.length)];
    }

    setResult(caughtFish);
    
    // Play sound based on rarity
    if (caughtFish) {
      if (caughtFish.rarity === 'Legendary' || caughtFish.rarity === 'NFT') {
        soundManager.play('catch_legendary');
      } else if (caughtFish.rarity === 'Rare' || caughtFish.rarity === 'Epic') {
        soundManager.play('catch_rare');
      } else if (caughtFish.rarity === 'Junk') {
        soundManager.play('junk');
      } else {
        soundManager.play('catch_common');
      }
    }

    setGameState('result');
    if (caughtFish) onCatch(caughtFish);
    
    setTimeout(() => {
      setGameState('idle');
      setResult(null);
    }, 4000);
  };

  return (
    <div className="relative w-full h-[60vh] bg-gradient-to-b from-sky-400 via-blue-400 to-blue-600 overflow-hidden rounded-t-3xl shadow-2xl border-x-8 border-t-8 border-white/20">
      {/* Horizon/Sky */}
      <div className="absolute top-0 w-full h-1/3 bg-gradient-to-b from-orange-200 to-sky-400 opacity-50" />
      
      {/* Waves Animation */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[200%] h-1 bg-white/10"
            style={{ top: `${40 + i * 12}%`, left: '-50%' }}
            animate={{
              x: i % 2 === 0 ? [0, 100, 0] : [0, -100, 0],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{
              duration: 5 + i,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Perspective Container */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 perspective-[1000px]">
        
        {/* Fishing Line/Bobber */}
        <AnimatePresence>
          {(gameState === 'waiting' || gameState === 'bite') && (
            <motion.div
              initial={{ y: -500, opacity: 0 }}
              animate={{ 
                y: 0, 
                opacity: 1,
                scale: gameState === 'bite' ? [1, 1.2, 1] : 1
              }}
              exit={{ y: -500, opacity: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
            >
              <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg" />
              <div className="w-0.5 h-64 bg-white/40 absolute bottom-full left-1/2 -translate-x-1/2" />
              {gameState === 'bite' && (
                <motion.div 
                  animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="absolute inset-0 bg-white rounded-full"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player/Rod (Back View) */}
        <div className="relative z-20 flex flex-col items-center">
          <motion.div
            animate={gameState === 'casting' ? { rotateX: [0, -45, 0], y: [0, -20, 0] } : {}}
            transition={{ duration: 1 }}
            className="w-2 h-64 bg-gradient-to-b from-slate-700 to-slate-900 rounded-full origin-bottom"
          >
            {/* Reel */}
            <motion.div 
              animate={
                gameState === 'result' ? { rotate: 360 * 8 } : 
                gameState === 'casting' ? { rotate: -360 * 2 } :
                gameState === 'bite' ? { x: [0, -1, 1, -1, 1, 0] } :
                { rotate: 0 }
              }
              transition={
                gameState === 'result' ? { duration: 4, ease: "easeOut" } :
                gameState === 'casting' ? { duration: 1, ease: "linear" } :
                gameState === 'bite' ? { repeat: Infinity, duration: 0.1 } :
                { duration: 0.5 }
              }
              className="absolute bottom-12 -right-2 w-8 h-8 bg-slate-800 rounded-full border-2 border-slate-600 flex items-center justify-center shadow-lg"
            >
              {/* Reel Handle/Detail to show rotation */}
              <div className="w-1 h-4 bg-slate-500 rounded-full absolute top-0" />
              <div className="w-4 h-1 bg-slate-500 rounded-full absolute left-0" />
              <div className="w-2 h-2 bg-slate-400 rounded-full z-10" />
            </motion.div>
          </motion.div>
          
          {/* Boat/Dock Edge */}
          <div className="w-64 h-24 bg-gradient-to-t from-amber-900 to-amber-800 rounded-t-full shadow-2xl border-t-4 border-amber-700/50" />
        </div>
      </div>

      {/* UI Overlays */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-black/60 backdrop-blur-md text-white px-6 py-3 rounded-full flex items-center gap-2 border border-white/20"
            >
              <AlertCircle size={20} className="text-yellow-400" />
              <span className="font-medium">{message}</span>
            </motion.div>
          )}

          {gameState === 'bite' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1.5 }}
              exit={{ scale: 0 }}
              className="text-white font-black text-6xl italic drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]"
            >
              BITE!
            </motion.div>
          )}

          {gameState === 'result' && result && (
            <motion.div
              initial={{ scale: 0, y: 100, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="neo-card p-10 flex flex-col items-center gap-6 pointer-events-auto max-w-sm w-full"
            >
              <div className="relative">
                <FishModel fish={result} />
                
                {/* Success Rays */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 -z-10 opacity-20"
                >
                  <div className="w-full h-full bg-[conic-gradient(from_0deg,transparent_0deg,white_20deg,transparent_40deg)] rounded-full scale-150" />
                </motion.div>
              </div>

              <div className="text-center space-y-1">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-500">New Catch Unlocked</p>
                <h3 className="text-4xl font-black text-slate-900 tracking-tight uppercase">{result.name}</h3>
                <div className="flex items-center justify-center gap-2">
                  <span className={`px-4 py-1 rounded-xl text-xs font-black uppercase tracking-widest border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${result.color.replace('text-', 'bg-')} text-white`}>
                    {result.rarity === 'NFT' ? `${result.nftTier} NFT` : result.rarity}
                  </span>
                  {result.value > 0 && (
                    <span className="flex items-center gap-1 text-yellow-600 font-black text-lg">
                      <Zap size={18} fill="currentColor" />
                      {result.value}
                    </span>
                  )}
                </div>
              </div>

              {result.rarity === 'NFT' && (
                <motion.div 
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-full bg-black p-1 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="bg-sun px-6 py-3 rounded-[12px] flex items-center justify-center gap-3 border-2 border-black">
                    <Sparkles size={20} className="text-black" />
                    <span className="text-sm font-black text-black">
                      CLAIMABLE {result.nftTier?.toUpperCase()} NFT!
                    </span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {gameState === 'result' && !result && (
            <motion.div
              initial={{ scale: 0, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="neo-card p-0 flex flex-col pointer-events-auto max-w-xs w-full overflow-hidden"
            >
              {/* Post Header */}
              <div className="px-6 py-4 border-b-4 border-black flex items-center gap-3 bg-slate-100">
                <div className="w-10 h-10 rounded-full bg-blue-500 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Anchor size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-black text-sm font-black uppercase tracking-wider">Fisherman's Daily</span>
                  <span className="text-slate-500 text-[10px] font-bold">Just now • Sad Reality</span>
                </div>
              </div>

              {/* Post Content */}
              <div className="p-8 flex flex-col items-center gap-6 bg-white">
                <div className="relative">
                  <motion.div
                    animate={{ 
                      rotate: [0, -10, 10, -10, 0],
                      y: [0, -5, 0]
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="text-8xl"
                  >
                    👻
                  </motion.div>
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -bottom-2 -right-2 bg-coral p-2 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Frown size={20} className="text-white" />
                  </motion.div>
                </div>

                <div className="space-y-3 text-center">
                  <h3 className="text-2xl font-black text-black uppercase tracking-tight">SO SORRY!</h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-bold italic px-2">
                    "{message}"
                  </p>
                </div>
              </div>

              {/* Post Footer / Reactions */}
              <div className="px-6 py-4 bg-slate-50 border-t-4 border-black flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-black">
                    <div className="w-6 h-6 rounded-full bg-sun border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                      <Trash2 size={12} />
                    </div>
                    <span className="text-xs font-black">404 Fish Found</span>
                  </div>
                </div>
                <div className="w-24 h-3 bg-slate-200 border-2 border-black rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 4, ease: "linear" }}
                    className="h-full bg-ocean-blue"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interaction Button */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black border-2 border-white px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className={`w-3 h-3 rounded-full border border-black ${attempts > 0 ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-white text-xs font-black uppercase tracking-widest">
            {attempts} Attempts Left
          </span>
        </motion.div>
        <button
          onClick={handleCast}
          disabled={gameState !== 'idle'}
          className="neo-button bg-sun text-black text-2xl py-5 px-16"
        >
          {gameState === 'idle' ? 'CAST LINE' : 'FISHING...'}
        </button>
      </div>
    </div>
  );
}
