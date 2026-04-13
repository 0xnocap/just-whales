import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FISH_LIST } from '../../constants/fishGameData';
import { Sparkles, AlertCircle, Zap, Frown, Trash2, Anchor } from 'lucide-react';
import { soundManager } from '../../lib/fishSoundService';

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
  "The fish are actually all at a party. You weren't invited.",
];

const CARD_STYLE = 'bg-[#111113] border border-white/[0.08] rounded-[1.5rem] shadow-2xl overflow-hidden';

function FishModel({ fish }: { fish: any }) {
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className={`absolute inset-0 rounded-full blur-3xl ${fish.color.replace('text-', 'bg-')}/20`}
      />

      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 1.5],
            opacity: [0.5, 0],
            y: [0, -40 - Math.random() * 40],
            x: [0, (Math.random() - 0.5) * 60],
          }}
          transition={{
            duration: 1 + Math.random(),
            repeat: Infinity,
            delay: i * 0.2,
          }}
          className="absolute w-2 h-2 bg-blue-200/40 rounded-full"
        />
      ))}

      <motion.div
        animate={{
          y: [0, -10, 0],
          rotate: [-5, 5, -5],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative z-10"
      >
        <div className="absolute inset-0 blur-md translate-y-4 opacity-30 text-8xl flex items-center justify-center">
          {fish.icon}
        </div>

        <motion.div
          animate={{
            rotateY: [0, 15, 0, -15, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="text-8xl drop-shadow-2xl flex items-center justify-center"
        >
          {fish.icon}
        </motion.div>
      </motion.div>

      {(fish.rarity === 'Legendary' || fish.rarity === 'NFT' || fish.rarity === 'Epic') && (
        <div className="absolute inset-0">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
                rotate: [0, 180],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
              className="absolute"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
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
      setMessage('No attempts left today!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (!useAttempt()) return;

    soundManager.play('cast');
    setGameState('casting');

    setTimeout(() => {
      setGameState('waiting');

      const waitTime = 2000 + Math.random() * 3000;
      setTimeout(() => {
        const isBite = Math.random() > 0.5;

        if (isBite) {
          soundManager.play('bite');
          setGameState('bite');
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

    if (roll > 99) {
      const nfts = FISH_LIST.filter(f => f.rarity === 'NFT');
      const nftRoll = Math.random() * 100;
      if (nftRoll > 95) {
        caughtFish = nfts.find(n => n.nftTier === 'Legendary');
      } else if (nftRoll > 80) {
        caughtFish = nfts.find(n => n.nftTier === 'Ultra Rare');
      } else if (nftRoll > 50) {
        caughtFish = nfts.find(n => n.nftTier === 'Rare');
      } else {
        caughtFish = nfts.find(n => n.nftTier === 'Common');
      }
      if (!caughtFish) caughtFish = nfts[Math.floor(Math.random() * nfts.length)];
    } else if (roll > 96) {
      const legendaries = FISH_LIST.filter(f => f.rarity === 'Legendary');
      caughtFish = legendaries[Math.floor(Math.random() * legendaries.length)];
    } else if (roll > 90) {
      const epics = FISH_LIST.filter(f => f.rarity === 'Epic');
      caughtFish = epics[Math.floor(Math.random() * epics.length)];
    } else if (roll > 80) {
      const rares = FISH_LIST.filter(f => f.rarity === 'Rare');
      caughtFish = rares[Math.floor(Math.random() * rares.length)];
    } else if (roll > 65) {
      const uncommons = FISH_LIST.filter(f => f.rarity === 'Uncommon');
      caughtFish = uncommons[Math.floor(Math.random() * uncommons.length)];
    } else if (roll > 35) {
      const junks = FISH_LIST.filter(f => f.rarity === 'Junk');
      caughtFish = junks[Math.floor(Math.random() * junks.length)];
    } else {
      const commons = FISH_LIST.filter(f => f.rarity === 'Common');
      caughtFish = commons[Math.floor(Math.random() * commons.length)];
    }

    setResult(caughtFish);

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
    <div className="relative w-full h-full bg-gradient-to-b from-sky-300 via-blue-400 to-blue-700 overflow-hidden">
      {/* Sky haze */}
      <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-orange-200/70 via-amber-100/20 to-transparent pointer-events-none" />

      {/* Sun */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{ top: '20px', right: '20px' }}
      >
        <div
          className="rounded-full bg-gradient-to-br from-yellow-100 via-amber-200 to-amber-300 shadow-[0_0_80px_20px_rgba(254,215,130,0.55),0_0_180px_60px_rgba(253,186,116,0.25)]"
          style={{ width: 'clamp(1.75rem, 3vw, 2.5rem)', height: 'clamp(1.75rem, 3vw, 2.5rem)' }}
        />
      </motion.div>

      {/* Shimmer on water */}
      <div className="absolute inset-x-0 bg-gradient-to-b from-amber-100/15 to-transparent pointer-events-none" style={{ top: '38%', height: '18%' }} />

      <div className="absolute inset-0 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[200%] h-1 bg-white/10"
            style={{ top: `${40 + i * 12}%`, left: '-50%' }}
            animate={{
              x: i % 2 === 0 ? [0, 100, 0] : [0, -100, 0],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 5 + i,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 perspective-[1000px]">
        <AnimatePresence>
          {(gameState === 'waiting' || gameState === 'bite') && (
            <motion.div
              initial={{ y: -500, opacity: 0 }}
              animate={{
                y: 0,
                opacity: 1,
                scale: gameState === 'bite' ? [1, 1.2, 1] : 1,
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

        <div className="relative z-20 flex flex-col items-center">
          <motion.div
            animate={gameState === 'casting' ? { rotateX: [0, -45, 0], y: [0, -20, 0] } : {}}
            transition={{ duration: 1 }}
            className="w-2 h-64 bg-gradient-to-b from-slate-700 to-slate-900 rounded-full origin-bottom"
          >
            <motion.div
              animate={
                gameState === 'result' ? { rotate: 360 * 8 } :
                gameState === 'casting' ? { rotate: -360 * 2 } :
                gameState === 'bite' ? { x: [0, -1, 1, -1, 1, 0] } :
                { rotate: 0 }
              }
              transition={
                gameState === 'result' ? { duration: 4, ease: 'easeOut' } :
                gameState === 'casting' ? { duration: 1, ease: 'linear' } :
                gameState === 'bite' ? { repeat: Infinity, duration: 0.1 } :
                { duration: 0.5 }
              }
              className="absolute bottom-12 -right-2 w-8 h-8 bg-slate-800 rounded-full border-2 border-slate-600 flex items-center justify-center shadow-lg"
            >
              <div className="w-1 h-4 bg-slate-500 rounded-full absolute top-0" />
              <div className="w-4 h-1 bg-slate-500 rounded-full absolute left-0" />
              <div className="w-2 h-2 bg-slate-400 rounded-full z-10" />
            </motion.div>
          </motion.div>

          <div className="w-64 h-24 bg-gradient-to-t from-amber-900 to-amber-800 rounded-t-full shadow-2xl border-t-4 border-amber-700/50" />
        </div>
      </div>

      <AnimatePresence>
        {gameState === 'result' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40">
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
              className={`${CARD_STYLE} p-8 flex flex-col items-center gap-4 pointer-events-auto max-w-xs w-full z-50 relative`}
            >
              <div className="relative">
                <FishModel fish={result} />

                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 -z-10 opacity-20"
                >
                  <div className="w-full h-full bg-[conic-gradient(from_0deg,transparent_0deg,white_20deg,transparent_40deg)] rounded-full scale-150" />
                </motion.div>
              </div>

              <div className="text-center space-y-1">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-dream-cyan">New Catch Unlocked</p>
                <h3 className="text-4xl font-black text-white tracking-tight uppercase">{result.name}</h3>
                <div className="flex items-center justify-center gap-2">
                  <span className={`px-4 py-1 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 ${result.color.replace('text-', 'bg-')}/20 text-white`}>
                    {result.rarity === 'NFT' ? `${result.nftTier} NFT` : result.rarity}
                  </span>
                  {result.value > 0 && (
                    <span className="flex items-center gap-1 text-sun font-black text-lg">
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
                  className="w-full bg-sun/10 border border-sun/30 rounded-2xl"
                >
                  <div className="px-6 py-3 flex items-center justify-center gap-3">
                    <Sparkles size={20} className="text-sun" />
                    <span className="text-sm font-black text-sun tracking-widest">
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
              className={`${CARD_STYLE} p-0 flex flex-col pointer-events-auto max-w-xs w-full z-50 relative`}
            >
              <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3 bg-white/[0.02]">
                <div className="w-10 h-10 rounded-full bg-dream-cyan/20 border border-dream-cyan/30 flex items-center justify-center text-dream-cyan">
                  <Anchor size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-sm font-black uppercase tracking-wider">Fisherman's Daily</span>
                  <span className="text-white/40 text-[10px] font-bold">Just now • Sad Reality</span>
                </div>
              </div>

              <div className="p-8 flex flex-col items-center gap-6">
                <div className="relative">
                  <motion.div
                    animate={{
                      rotate: [0, -10, 10, -10, 0],
                      y: [0, -5, 0],
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="text-8xl"
                  >
                    👻
                  </motion.div>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -bottom-2 -right-2 bg-coral/20 border border-coral/40 p-2 rounded-full"
                  >
                    <Frown size={20} className="text-coral" />
                  </motion.div>
                </div>

                <div className="space-y-3 text-center">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">SO SORRY!</h3>
                  <p className="text-white/60 text-sm leading-relaxed font-bold italic px-2">
                    "{message}"
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-white/70">
                    <div className="w-6 h-6 rounded-full bg-sun/20 border border-sun/30 flex items-center justify-center">
                      <Trash2 size={12} className="text-sun" />
                    </div>
                    <span className="text-xs font-black">404 Fish Found</span>
                  </div>
                </div>
                <div className="w-24 h-3 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 4, ease: 'linear' }}
                    className="h-full bg-dream-cyan"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {gameState !== 'bite' && gameState !== 'result' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-4"
          >
            <div className="bg-black/60 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
              <div className={`w-3 h-3 rounded-full ${attempts > 0 ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-white text-xs font-black uppercase tracking-widest">
                {attempts} Attempts Left
              </span>
            </div>
            <button
              onClick={handleCast}
              disabled={gameState !== 'idle'}
              className="rounded-full font-sans font-black uppercase tracking-[0.2em] bg-dream-cyan text-[#0a0a0c] hover:scale-[1.03] active:scale-[0.98] shadow-[0_0_32px_-4px_rgba(34,211,238,0.7)] hover:shadow-[0_0_40px_-2px_rgba(34,211,238,0.9)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 text-base px-12 py-3.5"
            >
              {gameState === 'idle' ? 'CAST LINE' : 'FISHING...'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
