import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[60vh] text-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-2xl"
      >
        <div className="mb-8 inline-block">
          <div className="relative">
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 6, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="text-8xl md:text-9xl filter drop-shadow-[0_0_30px_rgba(34,211,238,0.3)]"
            >
              🐋
            </motion.div>
          </div>
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-6 leading-none">
          WELCOME TO <span className="text-dream-cyan">WHALE TOWN</span>
        </h1>
        
        <p className="text-lg md:text-xl font-mono text-white/50 mb-10 tracking-tight leading-relaxed max-w-xl mx-auto">
          The first generative onchain collection on Tempo. 3,333 unique sea creatures living forever on the blockchain.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate('/trade')}
            className="w-full sm:w-auto px-8 py-4 bg-dream-cyan text-[#0a0a0c] font-black font-mono tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-dream-cyan/20 cursor-pointer"
          >
            TRADE NOW
          </button>
          <button
            onClick={() => navigate('/mint')}
            className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white border border-white/10 font-black font-mono tracking-[0.2em] rounded-2xl hover:bg-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            MINT NFT
          </button>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 border-t border-white/5 pt-12">
          <div>
            <div className="text-2xl font-bold text-white mb-1">3,333</div>
            <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Total Supply</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white mb-1">FREE</div>
            <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Mint Price</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white mb-1">100%</div>
            <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">On-Chain</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage;
