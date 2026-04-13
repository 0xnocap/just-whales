import { motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';

interface RetroButtonProps {
  icon: any;
  label: string;
  to: string;
  disabled?: boolean;
  tooltip?: string;
}

const RetroButton = ({ icon: Icon, label, to, disabled, tooltip }: RetroButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === to || (to === '/profile' && location.pathname.startsWith('/profile'));
  const onClick = () => {
    if (disabled) return;
    navigate(to);
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`relative group flex flex-col items-center justify-center rounded-xl border transition-all duration-300 ${
        active
          ? 'border-dream-cyan/40 bg-white/[0.08] backdrop-blur-xl shadow-[0_0_15px_rgba(34,211,238,0.15)]'
          : disabled
            ? 'border-transparent bg-transparent opacity-40 cursor-not-allowed'
            : 'border-transparent bg-transparent hover:bg-white/[0.04]'
      }`}
      style={{ width: 'clamp(3.5rem, 6vw, 6rem)', height: 'clamp(3.5rem, 6vw, 6rem)' }}
      whileHover={disabled ? {} : { scale: 1.05, y: -2 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
    >
      <Icon className={`mb-1 z-10 transition-colors duration-300 ${active ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`} style={{ width: 'clamp(1.1rem, 1.5vw, 1.25rem)', height: 'clamp(1.1rem, 1.5vw, 1.25rem)' }} />
      <span className={`font-mono font-bold tracking-[0.15em] uppercase z-10 transition-colors duration-300 ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`} style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
        {tooltip && !active ? tooltip : label}
      </span>
    </motion.button>
  );
};

export default RetroButton;
