import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, AlertCircle, Zap, Frown, Trash2, Anchor } from 'lucide-react';
import { soundManager } from '../../lib/fishSoundService';

const CARD_STYLE = 'bg-[#111113] border border-white/[0.08] rounded-[1.5rem] shadow-2xl overflow-hidden';

function FishModel({ fish }: { fish: any }) {
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
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
            y: [0, -30 - Math.random() * 30],
            x: [0, (Math.random() - 0.5) * 45],
          }}
          transition={{ duration: 1 + Math.random(), repeat: Infinity, delay: i * 0.2 }}
          className="absolute w-1.5 h-1.5 bg-blue-200/40 rounded-full"
        />
      ))}
      <motion.div
        animate={{ y: [0, -8, 0], rotate: [-5, 5, -5], scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10"
      >
        <div className="absolute inset-0 blur-md translate-y-3 opacity-30 text-6xl flex items-center justify-center">
          {fish.icon}
        </div>
        <motion.div
          animate={{ rotateY: [0, 15, 0, -15, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-6xl drop-shadow-2xl flex items-center justify-center"
        >
          {fish.icon}
        </motion.div>
      </motion.div>
      {(fish.rarity === 'Legendary' || fish.rarity === 'NFT' || fish.rarity === 'Epic') && (
        <div className="absolute inset-0">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 180] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              className="absolute"
              style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%` }}
            >
              <Sparkles size={12} className="text-yellow-400" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

type GamePhase = 'idle' | 'casting' | 'waiting' | 'bite' | 'result' | 'toast';

interface GameSceneProps {
  cast: () => Promise<any>;
  attempts: number;
}

export default function GameScene({ cast, attempts }: GameSceneProps) {
  const [gameState, setGameState] = useState<GamePhase>('idle');
  const [result, setResult] = useState<any>(null);
  const [cardMessage, setCardMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setGameState('toast');
    setTimeout(() => {
      setGameState('idle');
      setToastMessage('');
      setCardMessage('');
      setResult(null);
    }, 2000);
  };

  const handleCast = async () => {
    if (gameState !== 'idle') return;

    if (attempts <= 0) {
      setToastMessage('No casts left today!');
      setTimeout(() => setToastMessage(''), 2000);
      return;
    }

    soundManager.play('cast');
    setGameState('casting');

    try {
      const castPromise = cast();

      setTimeout(async () => {
        setGameState('waiting');
        const waitTime = 2000 + Math.random() * 3000;

        const [serverData] = await Promise.all([
          castPromise,
          new Promise(resolve => setTimeout(resolve, waitTime)),
        ]);

        if (serverData.result === 'catch') {
          soundManager.play('bite');
          setGameState('bite');
          setTimeout(() => {
            const caughtFish = serverData.fish;
            setResult(caughtFish);
            if (caughtFish.rarity === 'Legendary' || caughtFish.rarity === 'NFT') {
              soundManager.play('catch_legendary');
            } else if (caughtFish.rarity === 'Rare' || caughtFish.rarity === 'Epic') {
              soundManager.play('catch_rare');
            } else if (caughtFish.rarity === 'Junk') {
              soundManager.play('junk');
            } else {
              soundManager.play('catch_common');
            }
            setGameState('result');
            // Card shows for 3.5s, then toast
            setTimeout(() => {
              const toast = caughtFish.value > 0
                ? `${caughtFish.name} caught! +${caughtFish.value} $OP`
                : `${caughtFish.name} caught!`;
              setResult(null);
              showToast(toast);
            }, 3500);
          }, 1500);

        } else if (serverData.result === 'no_bite') {
          setCardMessage(serverData.message);
          setGameState('result');
          // Card shows for 3s, then toast
          setTimeout(() => {
            showToast(serverData.message);
          }, 3000);

        } else {
          setGameState('idle');
          setToastMessage(serverData.error || 'Something went wrong');
          setTimeout(() => setToastMessage(''), 2000);
        }
      }, 1000);
    } catch (e: any) {
      setGameState('idle');
      setToastMessage(e.message || 'Connection error');
      setTimeout(() => setToastMessage(''), 2000);
    }
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

      {/* Water shimmer */}
      <div className="absolute inset-x-0 bg-gradient-to-b from-amber-100/15 to-transparent pointer-events-none" style={{ top: '38%', height: '18%' }} />
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[200%] h-1 bg-white/10"
            style={{ top: `${40 + i * 12}%`, left: '-50%' }}
            animate={{ x: i % 2 === 0 ? [0, 100, 0] : [0, -100, 0], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </div>

      {/* Fishing line + bobber */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-12">
        <AnimatePresence>
          {(gameState === 'waiting' || gameState === 'bite') && (
            <motion.div
              initial={{ y: -500, opacity: 0 }}
              animate={{ y: 0, opacity: 1, scale: gameState === 'bite' ? [1, 1.2, 1] : 1 }}
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

      {/* Backdrop for result card */}
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

      {/* BITE! flash */}
      <AnimatePresence>
        {gameState === 'bite' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <span className="text-white font-black text-6xl italic drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]">
              BITE!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result cards — centered, 20% smaller via scale */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
        <AnimatePresence>
          {/* Catch card */}
          {gameState === 'result' && result && (
            <motion.div
              key="catch-card"
              initial={{ scale: 0, y: 60, opacity: 0 }}
              animate={{ scale: 0.8, y: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className={`${CARD_STYLE} p-8 flex flex-col items-center gap-4 pointer-events-auto max-w-xs w-full`}
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
                <p className="text-xs font-black uppercase tracking-[0.3em] text-dream-cyan">New Catch</p>
                <h3 className="text-3xl font-black text-white tracking-tight uppercase">{result.name}</h3>
                <div className="flex items-center justify-center gap-2">
                  <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 ${result.color.replace('text-', 'bg-')}/20 text-white`}>
                    {result.rarity === 'NFT' ? `${result.nftTier} NFT` : result.rarity}
                  </span>
                  {result.value > 0 && (
                    <span className="flex items-center gap-1 text-sun font-black text-base">
                      <Zap size={15} fill="currentColor" />
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
                  <div className="px-5 py-2.5 flex items-center justify-center gap-2">
                    <Sparkles size={16} className="text-sun" />
                    <span className="text-xs font-black text-sun tracking-widest">
                      CLAIMABLE {result.nftTier?.toUpperCase()} NFT!
                    </span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* No-bite card */}
          {gameState === 'result' && !result && (
            <motion.div
              key="no-bite-card"
              initial={{ scale: 0, y: 40, opacity: 0 }}
              animate={{ scale: 0.8, y: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className={`${CARD_STYLE} p-0 flex flex-col pointer-events-auto max-w-xs w-full`}
            >
              <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3 bg-white/[0.02]">
                <div className="w-9 h-9 rounded-full bg-dream-cyan/20 border border-dream-cyan/30 flex items-center justify-center text-dream-cyan">
                  <Anchor size={17} />
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-sm font-black uppercase tracking-wider">Fisherman's Daily</span>
                  <span className="text-white/40 text-[10px] font-bold">Just now • Sad Reality</span>
                </div>
              </div>
              <div className="px-6 py-6 flex flex-col items-center gap-4">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -10, 0], y: [0, -4, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="text-6xl"
                  >
                    👻
                  </motion.div>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -bottom-2 -right-2 bg-coral/20 border border-coral/40 p-1.5 rounded-full"
                  >
                    <Frown size={16} className="text-coral" />
                  </motion.div>
                </div>
                <div className="space-y-2 text-center">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">SO SORRY!</h3>
                  <p className="text-white/60 text-xs leading-relaxed font-bold italic px-2">
                    "{cardMessage}"
                  </p>
                </div>
              </div>
              <div className="px-5 py-3 bg-white/[0.02] border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-white/70">
                  <div className="w-5 h-5 rounded-full bg-sun/20 border border-sun/30 flex items-center justify-center">
                    <Trash2 size={10} className="text-sun" />
                  </div>
                  <span className="text-xs font-black">404 Fish Found</span>
                </div>
                <div className="w-20 h-2.5 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 3, ease: 'linear' }}
                    className="h-full bg-dream-cyan"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast — appears AFTER the card, near the top */}
      <AnimatePresence>
        {(gameState === 'toast' || toastMessage) && toastMessage && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-black/70 backdrop-blur-md text-white px-5 py-2.5 rounded-full flex items-center gap-2 border border-white/20 shadow-xl whitespace-nowrap max-w-[90vw]">
              <AlertCircle size={15} className="text-yellow-400 flex-shrink-0" />
              <span className="font-semibold text-sm truncate">{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cast button */}
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
              disabled={gameState !== 'idle' || attempts <= 0}
              className="rounded-full font-sans font-black uppercase tracking-[0.2em] bg-dream-cyan text-[#0a0a0c] hover:scale-[1.03] active:scale-[0.98] shadow-[0_0_32px_-4px_rgba(34,211,238,0.7)] hover:shadow-[0_0_40px_-2px_rgba(34,211,238,0.9)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 text-base px-12 py-3.5"
            >
              {attempts <= 0 ? 'NO CASTS LEFT' : gameState === 'idle' ? 'CAST LINE' : 'FISHING...'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
