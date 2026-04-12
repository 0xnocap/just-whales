import React from 'react';

const StakingPage: React.FC = () => {
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

export default StakingPage;
