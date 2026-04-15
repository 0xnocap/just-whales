import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Coins, User, ArrowLeftRight } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Routes, Route, useLocation, Link, Navigate } from 'react-router-dom';

import type { ModalTokenProps } from './types';
import DreamwaveOcean from './components/DreamwaveOcean';
import RetroButton from './components/RetroButton';
import FishingPoleIcon from './components/FishingPoleIcon';
import TokenModal from './components/TokenModal';
import HomePage from './pages/HomePage';
import StakingPage from './pages/StakingPage';
import TradePage from './pages/TradePage';
import ProfilePage from './pages/ProfilePage';
import FishPage from './pages/FishPage';
import { usePointsBalance, useStakingReads } from './hooks/useStaking';
import { useRewards } from './hooks/useRewards';

function formatWei(wei: bigint): string {
  const n = Number(wei) / 1e18;
  return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
}

function PointsBadge() {
  const { isConnected } = useAccount();
  const { raw: walletRaw, formatted: walletFormatted } = usePointsBalance();
  const { rewardsRaw: stakingRaw, rewardsFormatted: stakingFormatted } = useStakingReads();
  const { rewards } = useRewards();

  if (!isConnected) return null;

  const tradingRaw = rewards ? BigInt(rewards.trading.unclaimedOP) : 0n;
  const fishingRaw = rewards ? BigInt(rewards.fishing.unclaimedOP) : 0n;
  const unclaimedRaw = stakingRaw + tradingRaw + fishingRaw;
  const totalRaw = walletRaw + unclaimedRaw;

  const totalFormatted = formatWei(totalRaw);
  const tradingFormatted = formatWei(tradingRaw);
  const fishingFormatted = formatWei(fishingRaw);

  return (
    <Link
      to="/profile?tab=rewards"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dream-purple/10 border border-dream-purple/30 hover:bg-dream-purple/20 transition-colors"
      title={`Wallet: ${walletFormatted} $OP\nUnclaimed Staking: ${stakingFormatted} $OP\nUnclaimed Trading: ${tradingFormatted} $OP\nUnclaimed Fishing: ${fishingFormatted} $OP`}
    >
      <span className="font-mono text-[11px] text-dream-purple font-bold uppercase tracking-tight mr-1">$OP</span>
      <span className="font-mono font-bold text-[11px] text-dream-white tracking-tight">{totalFormatted}</span>
    </Link>
  );
}

export default function App() {
  const [modalToken, setModalToken] = useState<ModalTokenProps | null>(null);
  const [sweepModeActive, setSweepModeActive] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const location = useLocation();
  const { isConnected, address } = useAccount();

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden">
      <DreamwaveOcean />

      {/* Header */}
      <div className="fixed z-50 flex items-center justify-between w-full" style={{ top: 'clamp(1rem, 3vh, 2.5rem)', left: 0, padding: '0 clamp(1rem, 2vw, 2.5rem)' }}>
        {/* Logo */}
        <Link to="/" className="flex items-center no-underline" style={{ gap: 'clamp(0.4rem, 0.6vw, 0.75rem)' }}>
          <img src="/coralexchange-icon.png" alt="Coral Exchange" className="rounded-lg shadow-md flex-shrink-0" style={{ width: 'clamp(1.25rem, 2vw, 1.75rem)', height: 'clamp(1.25rem, 2vw, 1.75rem)' }} />
          <span className="font-sans font-bold tracking-tight text-dream-white leading-none mt-[2px]" style={{ fontSize: 'clamp(1rem, 1.5vw, 1.6rem)' }}>
            {location.pathname === '/trade' ? (
              <>CORAL<span className="text-dream-cyan opacity-60 ml-0.5">EXCHANGE</span></>
            ) : (
              <>WHALE<span className="text-dream-cyan opacity-60">TOWN</span></>
            )}
          </span>
        </Link>
        {/* Wallet */}
        <div className="flex items-center gap-2">
          <PointsBadge />
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 w-full flex flex-col items-center flex-1" style={{ paddingTop: 'clamp(5rem, 10vh, 7rem)', paddingBottom: 'clamp(5rem, 10vh, 7rem)' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="w-full flex flex-col items-center"
            style={{
              maxWidth:
                location.pathname === '/trade' || location.pathname.startsWith('/profile')
                  ? 'clamp(32rem, 80vw, 72rem)'
                  : location.pathname === '/fish'
                  ? 'clamp(32rem, 80vw, 64rem)'
                  : 'clamp(28rem, 65vw, 52rem)',
            }}
          >
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/staking" element={<StakingPage />} />
              <Route path="/trade" element={<TradePage onSelectToken={setModalToken} onSweepModeChange={setSweepModeActive} showActivity={showActivity} setShowActivity={setShowActivity} />} />
              <Route path="/profile" element={<ProfilePage onSelectToken={setModalToken} />} />
              <Route path="/profile/:address" element={<ProfilePage onSelectToken={setModalToken} />} />
              <Route path="/fish" element={<FishPage />} />
<Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation Buttons — hidden when sweep mode is active */}
      <AnimatePresence>
        {!sweepModeActive && (
          <motion.nav
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed z-50 left-1/2 -translate-x-1/2 flex justify-center items-center bg-[#072436]/40 backdrop-blur-[32px] border border-white/[0.08] shadow-[0_4px_12px_rgba(0,0,0,0.5)] saturate-[1.2]"
            style={{ bottom: 'clamp(0.75rem, 1.5vh, 1.25rem)', gap: 'clamp(0.25rem, 0.5vw, 0.5rem)', padding: 'clamp(0.3rem, 0.5vw, 0.5rem)', borderRadius: '1.25rem' }}
          >
            <RetroButton icon={Home} label="Home" to="/" />
            <RetroButton icon={ArrowLeftRight} label="Trade" to="/trade" />
            <RetroButton icon={Coins} label="Stake" to="/staking" />
            <RetroButton icon={FishingPoleIcon} label="Fish" to="/fish" />
            <RetroButton icon={User} label="Profile" to={isConnected && address ? `/profile/${address}` : '/profile'} />
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Token Detail Modal */}
      <AnimatePresence>
        {modalToken && <TokenModal token={modalToken} onClose={() => setModalToken(null)} />}
      </AnimatePresence>

      {/* Background fill */}
      <div className="fixed inset-0 -z-10 bg-gradient-radial pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, #164e63 0%, #083344 100%)' }} />
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.05] bg-gradient-to-b from-dream-cyan/10 via-transparent to-dream-purple/10" />
    </div>
  );
}
