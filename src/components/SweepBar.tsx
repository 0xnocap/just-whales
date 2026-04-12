import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, X, Loader2, ShoppingCart } from 'lucide-react';

interface SweepBarProps {
  selectedListings: any[];
  onRemove: (id: bigint) => void;
  onClearAll: () => void;
  onSweep: () => void;
  isSweeping: boolean;
  sweepResult: { succeeded: number; failed: number } | null;
}

const SweepBar: React.FC<SweepBarProps> = ({
  selectedListings,
  onRemove,
  onClearAll,
  onSweep,
  isSweeping,
  sweepResult,
}) => {
  const totalCost = selectedListings.reduce((sum, l) => sum + Number(l.price), 0);
  const totalUSD = (totalCost / 1e6).toFixed(2);

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed left-1/2 -translate-x-1/2 z-[150] w-full max-w-2xl px-4"
      style={{ bottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}
    >
      <div
        className="relative rounded-2xl border border-white/10 overflow-hidden"
        style={{
          background: 'rgba(10,10,14,0.92)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 0 60px rgba(34,211,238,0.12), 0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Glow line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-dream-cyan/60 to-transparent" />

        <div className="px-5 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-dream-cyan" />
              <span className="font-mono text-[11px] font-bold text-dream-cyan uppercase tracking-[0.2em]">
                Floor Sweep
              </span>
              <span className="bg-dream-cyan/15 text-dream-cyan font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                {selectedListings.length} selected
              </span>
            </div>
            <button
              onClick={onClearAll}
              className="text-white/30 hover:text-white/70 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Token chips */}
          {selectedListings.length > 0 && (
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
              {selectedListings.map((l) => (
                <div
                  key={String(l.id)}
                  className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 flex-shrink-0"
                >
                  <span className="font-mono text-white/70 text-[10px]">
                    #{String(l.tokenId)}
                  </span>
                  <span className="font-mono text-dream-cyan text-[10px] font-bold">
                    ${(Number(l.price) / 1e6).toFixed(2)}
                  </span>
                  <button
                    onClick={() => onRemove(l.id)}
                    className="text-white/20 hover:text-white/60 transition-colors cursor-pointer ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer: total + buy button */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[9px] font-mono text-white/30 uppercase tracking-[0.15em] mb-0.5">Total</div>
              <div className="text-2xl font-black text-white">
                ${totalUSD}
                <span className="text-sm font-normal text-white/30 ml-1">pathUSD</span>
              </div>
            </div>

            {sweepResult ? (
              <div className={`font-mono text-xs font-bold px-4 py-2 rounded-xl ${
                sweepResult.failed === 0
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
              }`}>
                ✓ {sweepResult.succeeded} bought{sweepResult.failed > 0 ? `, ${sweepResult.failed} skipped` : ''}
              </div>
            ) : (
              <button
                onClick={onSweep}
                disabled={isSweeping || selectedListings.length === 0}
                className="flex items-center gap-2 bg-dream-cyan hover:bg-dream-cyan/90 text-[#0a0a0c] font-black font-mono text-sm px-6 py-3 rounded-xl tracking-[0.05em] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-dream-cyan/20"
              >
                {isSweeping ? (
                  <><Loader2 className="animate-spin w-4 h-4" /> SWEEPING...</>
                ) : (
                  <><ShoppingCart className="w-4 h-4" /> BUY {selectedListings.length}</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SweepBar;
