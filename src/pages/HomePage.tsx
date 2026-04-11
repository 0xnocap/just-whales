import React from 'react';
import { motion } from 'motion/react';

const HomePage: React.FC = () => {
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

      {/* Pirate Warning */}
      <div className="flex justify-center mb-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="rounded-full border border-dream-purple/30 bg-dream-purple/5 backdrop-blur-md font-mono font-bold tracking-[0.2em] text-dream-purple/70 uppercase flex items-center gap-2"
          style={{ fontSize: 'clamp(8px, 0.75vw, 10px)', padding: 'clamp(4px, 0.6vh, 6px) clamp(16px, 2vw, 24px)' }}
        >
          <span className="hidden sm:inline">💀</span> don't swim out to deep waters - pirates are approaching.
        </motion.div>
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

export default HomePage;
