import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Waves, Layers, Trophy, Info, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import {
  usePointsBalance,
  useStakingReads,
  useStakingActions,
  useTokenRates,
  useTokenImages,
  useUnstakedTokens,
  sumDailyRate,
} from '../hooks/useStaking';
import { stakingAddress } from '../contract';

const StakingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stake' | 'rewards'>('stake');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { isConnected } = useAccount();

  const { stakedIds, rewardsFormatted, rewardsRaw, paused, refetch: refetchStaking } = useStakingReads();
  const { unstaked, loading: loadingUnstaked, refetch: refetchUnstaked } = useUnstakedTokens(stakedIds);
  const { refetch: refetchPoints, formatted: pointsBalance } = usePointsBalance();

  const allTokensForRates = useMemo(() => [...stakedIds, ...unstaked], [stakedIds, unstaked]);
  const { rates: tokenRates, loading: loadingRates } = useTokenRates(allTokensForRates);
  const { images, loading: loadingImages } = useTokenImages(allTokensForRates);

  const onTxDone = useCallback(() => {
    refetchStaking();
    refetchUnstaked();
    refetchPoints();
    setSelected(new Set());
  }, [refetchStaking, refetchUnstaked, refetchPoints]);

  const { stake, unstake, claim, state, error } = useStakingActions(onTxDone);

  const dailyYieldStaked = sumDailyRate(tokenRates, stakedIds);
  const totalPotentialYield = useMemo(() => {
    const ids = allTokensForRates;
    return sumDailyRate(tokenRates, ids);
  }, [allTokensForRates, tokenRates]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const contractsConfigured = !!stakingAddress && (stakingAddress as string) !== 'undefined';
  const isBusy = state !== 'idle';
  const canStake = selected.size > 0 && !paused && !isBusy;
  const canUnstake = stakedIds.length > 0 && !isBusy;
  const canClaim = rewardsRaw > 0n && !paused && !isBusy;

  const selectedStaked = useMemo(() => [...selected].filter((id) => stakedIds.includes(id)), [selected, stakedIds]);
  const selectedUnstaked = useMemo(() => [...selected].filter((id) => !stakedIds.includes(id)), [selected, stakedIds]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-[#072436]/60 border border-white/10 backdrop-blur-[40px] rounded-[2rem] overflow-hidden shadow-[0_0_80px_rgba(34,211,238,0.1)] flex flex-col h-[560px]">
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

        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
          <AnimatePresence mode="wait">
            {activeTab === 'stake' ? (
              <motion.div
                key="stake"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex-1 flex flex-col"
              >
                <div className="w-full flex-1 flex flex-col space-y-4">
                    <div className="text-center space-y-1">
                      <h2 className="text-lg font-bold tracking-tighter text-dream-white uppercase leading-none">OCEAN POINTS EMISSIONS</h2>
                      <p className="text-dream-cyan/40 font-mono text-[7px] uppercase tracking-[0.3em]">Whale Town Staking Protocol</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 p-4 rounded-[1.25rem] border border-white/10 text-center shadow-inner">
                        <div className="text-dream-cyan font-bold text-xl tracking-tighter">
                          {totalPotentialYield > 0 ? `${totalPotentialYield.toFixed(2)} $OP` : '—'}
                        </div>
                        <div className="text-[8px] font-mono text-white/30 uppercase tracking-[0.2em] mt-1">Daily Potential</div>
                      </div>
                      <div className="bg-white/5 p-4 rounded-[1.25rem] border border-white/10 text-center shadow-inner">
                        <div className="text-dream-white font-bold text-xl tracking-tighter">{stakedIds.length}</div>
                        <div className="text-[8px] font-mono text-white/30 uppercase tracking-[0.2em] mt-1">NFTs Staked</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center px-1">
                        <h3 className="text-[9px] font-mono text-white/60 uppercase tracking-[0.3em] font-bold">Your Inventory</h3>
                        <span className="text-[8px] font-mono text-dream-cyan/50 uppercase tracking-widest">
                          {loadingUnstaked ? 'scanning…' : `${unstaked.length} unstaked`}
                        </span>
                      </div>

                      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar-horizontal snap-x">
                        {(loadingUnstaked || loadingRates || loadingImages) ? (
                          <div className="flex-1 text-center text-[9px] font-mono text-white/30 uppercase tracking-widest py-8">
                            Loading Inventory...
                          </div>
                        ) : !isConnected ? (
                          <div className="flex-1 text-center text-[9px] font-mono text-white/30 uppercase tracking-widest py-8">
                            Connect wallet
                          </div>
                        ) : unstaked.length === 0 ? (
                          <div className="flex-1 text-center text-[9px] font-mono text-white/30 uppercase tracking-widest py-8">
                            No unstaked whales
                          </div>
                        ) : (
                          unstaked.map((id) => {
                            const isSelected = selected.has(id);
                            const rate = Number(tokenRates[id] ?? 0n) / 1e18;
                            const img = images[id]?.image_data;
                            return (
                              <button
                                key={id}
                                onClick={() => toggleSelect(id)}
                                className="flex-shrink-0 w-28 flex flex-col gap-1.5 snap-start group cursor-pointer"
                              >
                                <div className={`w-28 aspect-square rounded-[1.25rem] overflow-hidden transition-all relative border ${
                                  isSelected
                                    ? 'border-dream-cyan shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                                    : 'border-white/10 group-hover:border-dream-cyan/30'
                                }`}>
                                  {img ? (
                                    <img src={img} alt={`#${id}`} className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                                  ) : (
                                    <div className="absolute inset-0 bg-white/[0.02]" />
                                  )}
                                  {isSelected && (
                                    <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-dream-cyan shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                  )}
                                </div>
                                <div className="flex items-center justify-between px-1">
                                  <span className="text-dream-white font-bold text-xs tracking-tighter">#{id}</span>
                                  <span className="text-[7px] font-mono text-dream-cyan/70 uppercase tracking-widest">
                                    {loadingRates ? '...' : (rate > 0 ? `${rate.toFixed(0)}/day` : '0/day')}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                  <div className="flex-1 flex flex-col justify-end">
                    <div className="flex flex-col items-center space-y-5">
                        {error && (
                          <div className="text-[9px] font-mono text-red-400/80 uppercase tracking-widest text-center">{error}</div>
                        )}
                        <button
                          onClick={() => stake(selectedUnstaked.length > 0 ? selectedUnstaked : [...selected])}
                          disabled={!canStake}
                          className={`w-full py-3 rounded-2xl font-bold font-mono tracking-[0.25em] uppercase text-xs border transition-all ${
                            canStake
                              ? 'bg-dream-cyan text-ocean-deep border-dream-cyan hover:shadow-[0_0_20px_rgba(34,211,238,0.5)]'
                              : 'bg-dream-cyan/10 text-dream-cyan/40 border-dream-cyan/20 cursor-not-allowed'
                          }`}
                        >
                          {isBusy && (state === 'approving' || state === 'staking') ? (
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> {state}…</span>
                          ) : paused ? 'Staking Paused' : !contractsConfigured ? 'Awaiting Launch' : selected.size > 0 ? `Stake ${selected.size} Whale${selected.size > 1 ? 's' : ''}` : 'Select NFTs to Stake'}
                        </button>
                        <motion.div
                        style={{marginBottom: "10px"}}
                          animate={{ y: [0, -2, 0] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                          className="p-2 rounded-full bg-dream-cyan/5 border border-dream-cyan/10 shadow-[0_0_15px_rgba(34,211,238,0.05)]"
                        >
                          <Waves className="w-3 h-3 text-dream-cyan/20" />
                        </motion.div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="rewards"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 flex flex-col items-center"
              >
                <div className="w-full space-y-3">
                  <div className="text-center py-4 bg-gradient-to-b from-dream-purple/5 via-white/[0.02] to-transparent rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col items-center justify-center">
                    <div className="relative mb-1">
                      <span className="text-6xl font-bold text-dream-white tracking-tighter leading-none">{rewardsFormatted}</span>
                      <div className="absolute left-full inset-y-0 flex items-center ml-3">
                        <span className="text-dream-white/40 text-4xl font-bold tracking-tighter whitespace-nowrap">$OP</span>
                      </div>
                    </div>
                    <div className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em] mt-2">Accumulated Ocean Points</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-3.5 rounded-[1.5rem] border border-white/10 flex flex-col items-center justify-center text-center shadow-inner">
                      <div className="relative text-dream-white font-bold text-xl leading-none">
                        {dailyYieldStaked.toFixed(2)}
                        <div className="absolute left-full inset-y-0 flex items-center ml-2">
                          <span className="text-dream-white/30 text-lg font-bold tracking-tight whitespace-nowrap">$OP</span>
                        </div>
                      </div>
                      <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mt-2">Daily Yield</div>
                    </div>
                    <div className="bg-white/5 p-3.5 rounded-[1.5rem] border border-white/10 flex flex-col items-center justify-center text-center shadow-inner">
                      <div className="relative text-dream-white font-bold text-xl leading-none">
                        {pointsBalance}
                        <div className="absolute left-full inset-y-0 flex items-center ml-2">
                          <span className="text-dream-white/30 text-lg font-bold tracking-tight whitespace-nowrap">$OP</span>
                        </div>
                      </div>
                      <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mt-2">Wallet Balance</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[10px] font-mono text-white/70 uppercase tracking-widest font-bold text-center">Staked Assets</h3>
                    {stakedIds.length === 0 ? (
                      <div className="bg-white/[0.02] border border-white/10 rounded-[1.5rem] p-4 flex flex-col items-center justify-center gap-2 border-dashed opacity-60">
                        <Layers className="w-6 h-6 text-white/10" />
                        <span className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em] font-bold">Deep Sea Vault Empty</span>
                      </div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar-horizontal snap-x">
                        {stakedIds.map((id) => {
                          const isSelected = selected.has(id);
                          const rate = Number(tokenRates[id] ?? 0n) / 1e18;
                          const img = images[id]?.image_data;
                          return (
                            <button
                              key={id}
                              onClick={() => toggleSelect(id)}
                              className="flex-shrink-0 w-28 flex flex-col gap-1.5 snap-start group"
                            >
                              <div className={`w-28 aspect-square rounded-[1.25rem] overflow-hidden transition-all relative border ${
                                isSelected
                                  ? 'border-dream-purple shadow-[0_0_15px_rgba(167,139,250,0.3)]'
                                  : 'border-white/10 group-hover:border-dream-purple/30'
                              }`}>
                                {img ? (
                                  <img src={img} alt={`#${id}`} className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                                ) : (
                                  <div className="absolute inset-0 bg-white/[0.02]" />
                                )}
                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-dream-purple shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                                )}
                              </div>
                              <div className="flex items-center justify-between px-1">
                                <span className="text-dream-white font-bold text-xs tracking-tighter">#{id}</span>
                                <span className="text-[7px] font-mono text-dream-purple/70 uppercase tracking-widest">
                                  {loadingRates ? '...' : `${rate.toFixed(0)}/day`}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => unstake(selectedStaked.length > 0 ? selectedStaked : stakedIds)}
                      disabled={!canUnstake}
                      className={`w-full py-3 rounded-2xl font-bold font-mono tracking-[0.25em] uppercase text-xs border transition-all ${
                        canUnstake
                          ? 'bg-dream-purple/10 text-dream-purple border-dream-purple/30 hover:bg-dream-purple/20'
                          : 'bg-white/5 text-white/20 border-white/10 cursor-not-allowed'
                      }`}
                    >
                      {isBusy && state === 'unstaking' ? (
                        <span className="inline-flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Unstaking...</span>
                      ) : 'Unstake All'}
                    </button>
                    <button
                      onClick={claim}
                      disabled={!canClaim}
                      className={`w-full py-3 rounded-2xl font-bold font-mono tracking-[0.25em] uppercase text-xs border transition-all ${
                        canClaim
                          ? 'bg-dream-purple text-ocean-deep border-dream-purple hover:shadow-[0_0_20px_rgba(167,139,250,0.5)]'
                          : 'bg-dream-purple/10 text-dream-purple/40 border-dream-purple/20 cursor-not-allowed'
                      }`}
                    >
                      {isBusy && state === 'claiming' ? (
                        <span className="inline-flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Claiming...</span>
                      ) : 'Claim Rewards'}
                    </button>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          .custom-scrollbar-horizontal::-webkit-scrollbar { height: 4px; }
          .custom-scrollbar-horizontal::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar-horizontal::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.1); border-radius: 20px; }
          .custom-scrollbar-horizontal::-webkit-scrollbar-thumb:hover { background: rgba(34, 211, 238, 0.3); }
        `}} />
      </div>
    </div>
  );
};

export default StakingPage;
