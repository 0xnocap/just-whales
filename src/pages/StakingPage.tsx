import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Waves, Sparkles, Anchor, Layers, Trophy, Info, ExternalLink } from 'lucide-react';

const StakingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stake' | 'rewards'>('stake');

  // Mock data for the UI
  const stakingData = {
    pool: {
      totalNFTsStaked: '4,250',
      pointsPerDayPerNFT: '10 $OP',
    },
    rewards: {
      unclaimedPoints: '0.00',
      dailyPointsYield: '0 $OP',
      totalPointsEarned: '0 $OP',
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-[#072436]/60 border border-white/10 backdrop-blur-[40px] rounded-[2rem] overflow-hidden shadow-[0_0_80px_rgba(34,211,238,0.1)] flex flex-col h-[650px]">
        {/* Refined Toggle Switcher */}
        <div className="p-4 bg-white/[0.03] border-b border-white/5 flex-shrink-0">
          <div className="flex bg-ocean-deep/80 rounded-2xl p-1.5 border border-white/10 relative h-14">
             <motion.div 
                layoutId="tab-pill"
                className={`absolute inset-y-1.5 w-[calc(50%-6px)] rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.2)] ${activeTab === 'stake' ? 'left-1.5 bg-dream-cyan' : 'left-[calc(50%+2px)] bg-dream-purple'}`}
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
             />
             <button 
                onClick={() => setActiveTab('stake')}
                className={`flex-1 flex items-center justify-center gap-3 relative z-10 transition-colors duration-300 ${activeTab === 'stake' ? 'text-ocean-deep font-bold' : 'text-white/30 hover:text-white/50'}`}
              >
                <Layers className={`w-4 h-4 ${activeTab === 'stake' ? 'text-ocean-deep' : 'text-dream-cyan opacity-40'}`} />
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] font-bold">Stake NFTs</span>
              </button>
              <button 
                onClick={() => setActiveTab('rewards')}
                className={`flex-1 flex items-center justify-center gap-3 relative z-10 transition-colors duration-300 ${activeTab === 'rewards' ? 'text-ocean-deep font-bold' : 'text-white/30 hover:text-white/50'}`}
              >
                <Trophy className={`w-4 h-4 ${activeTab === 'rewards' ? 'text-ocean-deep' : 'text-dream-purple opacity-40'}`} />
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] font-bold">$OP Rewards</span>
              </button>
          </div>
        </div>

        {/* Content Area - ABSOLUTE VERTICAL CENTERING */}
        <div className="flex-1 overflow-hidden p-8 flex flex-col">
          <AnimatePresence mode="wait">
            {activeTab === 'stake' ? (
              <motion.div
                key="stake"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex-1 flex flex-col justify-center items-center h-full"
              >
                <div className="w-full space-y-8">
                  {/* Internal Brand Header */}
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-bold tracking-tighter text-dream-white uppercase leading-none">OCEAN EMISSIONS</h2>
                    <p className="text-dream-cyan/40 font-mono text-[8px] uppercase tracking-[0.3em]">Whale Town Staking Protocol</p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-5 rounded-[1.5rem] border border-white/10 text-center shadow-inner">
                      <div className="text-dream-cyan font-bold text-2xl tracking-tighter">{stakingData.pool.pointsPerDayPerNFT}</div>
                      <div className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em] mt-1">Emission Rate</div>
                    </div>
                    <div className="bg-white/5 p-5 rounded-[1.5rem] border border-white/10 text-center shadow-inner">
                      <div className="text-dream-white font-bold text-2xl tracking-tighter">{stakingData.pool.totalNFTsStaked}</div>
                      <div className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em] mt-1">NFTs Staked</div>
                    </div>
                  </div>

                  {/* NFT Picker */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <h3 className="text-[10px] font-mono text-white/60 uppercase tracking-[0.3em] font-bold">Your Inventory</h3>
                      <button className="flex items-center gap-1 text-[9px] font-mono text-dream-cyan/50 hover:text-dream-cyan transition-colors uppercase tracking-widest group">
                        Browse All <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-horizontal snap-x">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="flex-shrink-0 w-32 aspect-square rounded-[1.5rem] bg-white/[0.02] border border-white/10 flex flex-col items-center justify-center gap-2 group hover:bg-white/[0.05] hover:border-dream-cyan/30 transition-all cursor-pointer snap-start relative overflow-hidden">
                          <div className="w-1 h-1 rounded-full bg-white/10 group-hover:bg-dream-cyan transition-all" />
                          <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest font-bold">Select</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action and Wave stack */}
                  <div className="space-y-6 flex flex-col items-center">
                    <div className="relative group w-full">
                      <button disabled className="w-full py-4 rounded-2xl bg-dream-cyan/10 text-dream-cyan/40 font-bold font-mono tracking-[0.3em] uppercase text-xs cursor-not-allowed border border-dream-cyan/20">
                        Initialize Staking
                      </button>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-ocean-deep/95 backdrop-blur-md rounded-2xl border border-dream-cyan/30">
                        <span className="font-mono font-bold text-dream-cyan uppercase tracking-widest text-[10px]">Awaiting Launch</span>
                      </div>
                    </div>
                    
                    <motion.div 
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="p-2.5 rounded-full bg-dream-cyan/5 border border-dream-cyan/10 shadow-[0_0_15px_rgba(34,211,238,0.05)]"
                    >
                      <Waves className="w-4 h-4 text-dream-cyan/20" />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="rewards"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 flex flex-col justify-center items-center h-full"
              >
                <div className="w-full space-y-6">
                  {/* Rewards Header */}
                  <div className="text-center py-6 bg-gradient-to-b from-dream-purple/5 via-white/[0.02] to-transparent rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col items-center justify-center">
                    <div className="flex items-baseline justify-center gap-2 mb-1">
                      <span className="text-5xl font-bold text-dream-white tracking-tighter leading-none">{stakingData.rewards.unclaimedPoints}</span>
                      <span className="text-dream-purple/60 text-xl font-mono font-bold uppercase tracking-widest">$OP</span>
                    </div>
                    <div className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em]">Accumulated Emissions</div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/10 flex flex-col items-center justify-center text-center shadow-inner">
                      <div className="text-dream-white font-bold text-lg leading-none">{stakingData.rewards.dailyPointsYield}</div>
                      <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mt-1">Daily Yield</div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/10 flex flex-col items-center justify-center text-center shadow-inner">
                      <div className="text-dream-white font-bold text-lg leading-none">{stakingData.rewards.totalPointsEarned}</div>
                      <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mt-1">Life-time</div>
                    </div>
                  </div>

                  {/* Staked Assets Placeholder */}
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-mono text-white/70 uppercase tracking-widest font-bold text-center">Staked Assets</h3>
                    <div className="bg-white/[0.02] border border-white/10 rounded-[1.5rem] p-5 flex flex-col items-center justify-center gap-2 border-dashed opacity-60">
                      <Layers className="w-6 h-6 text-white/10" />
                      <span className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em] font-bold">Deep Sea Vault Empty</span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button disabled className="flex-2 py-4 rounded-2xl bg-dream-purple/10 text-dream-purple/40 font-bold font-mono tracking-[0.3em] uppercase text-xs cursor-not-allowed border border-dream-purple/20 shadow-lg">
                      Claim $OP
                    </button>
                    <button disabled className="flex-1 py-4 rounded-2xl bg-white/5 text-white/20 font-mono tracking-[0.2em] uppercase text-xs cursor-not-allowed border border-white/10">
                      Unstake
                    </button>
                  </div>

                  {/* Info Box */}
                  <div className="bg-ocean-deep/40 border border-white/5 px-4 py-2.5 rounded-2xl flex items-start gap-3 w-full">
                    <div className="mt-0.5 flex-shrink-0"><Info className="w-3.5 h-3.5 text-dream-cyan opacity-30" /></div>
                    <p className="text-[8px] text-white/30 leading-relaxed font-mono italic">Emission cycles reset every 24 hours. Early unstaking may result in temporary yield penalties.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Custom Styles for Scrollbars */}
        <style dangerouslySetInnerHTML={{ __html: `
          .custom-scrollbar-horizontal::-webkit-scrollbar {
            height: 4px;
          }
          .custom-scrollbar-horizontal::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 20px;
          }
          .custom-scrollbar-horizontal::-webkit-scrollbar-thumb {
            background: rgba(34, 211, 238, 0.1);
            border-radius: 20px;
          }
          .custom-scrollbar-horizontal::-webkit-scrollbar-thumb:hover {
            background: rgba(34, 211, 238, 0.3);
          }
        `}} />
      </div>
    </div>
  );
};

export default StakingPage;
