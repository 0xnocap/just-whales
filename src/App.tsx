import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Coins, User, ArrowLeftRight, ChevronLeft } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';

import type { ModalTokenProps } from './types';
import DreamwaveOcean from './components/DreamwaveOcean';
import RetroButton from './components/RetroButton';
import FishingPoleIcon from './components/FishingPoleIcon';
import TokenModal from './components/TokenModal';
import HomePage from './pages/HomePage';
import StakingPage from './pages/StakingPage';
import TradePage from './pages/TradePage';
import MintPage from './pages/MintPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const [modalToken, setModalToken] = useState<ModalTokenProps | null>(null);
  const [sweepModeActive, setSweepModeActive] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
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
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
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
            style={{ maxWidth: location.pathname === '/trade' || location.pathname.startsWith('/profile') ? 'clamp(32rem, 80vw, 72rem)' : 'clamp(28rem, 65vw, 52rem)' }}
          >
            {/* Back button */}
            {location.pathname !== '/' && !location.pathname.startsWith('/trade') && (
              <div className="w-full flex" style={{ marginBottom: 'clamp(0.4rem, 0.8vh, 0.6rem)' }}>
                <button
                  onClick={() => navigate(-1)}
                  className="flex items-center justify-center bg-white/5 border border-white/10 rounded-full text-dream-cyan hover:bg-white/10 transition-all cursor-pointer group backdrop-blur-xl"
                  style={{ width: 'clamp(1.75rem, 2.5vw, 2.25rem)', height: 'clamp(1.75rem, 2.5vw, 2.25rem)' }}
                >
                  <ChevronLeft className="group-hover:-translate-x-0.5 transition-transform" style={{ width: 'clamp(0.7rem, 1vw, 0.9rem)', height: 'clamp(0.7rem, 1vw, 0.9rem)' }} />
                </button>
              </div>
            )}
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/staking" element={<StakingPage />} />
              <Route path="/trade" element={<TradePage onSelectToken={setModalToken} onSweepModeChange={setSweepModeActive} showActivity={showActivity} setShowActivity={setShowActivity} />} />
              <Route path="/mint" element={<MintPage onMintSuccess={setModalToken} />} />
              <Route path="/profile" element={<ProfilePage onSelectToken={setModalToken} />} />
              <Route path="/profile/:address" element={<ProfilePage onSelectToken={setModalToken} />} />
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
            <RetroButton icon={FishingPoleIcon} label="Fish" to="#" disabled />
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
