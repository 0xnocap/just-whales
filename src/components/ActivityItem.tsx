import React from 'react';
import { Tag, Sparkles, ArrowLeftRight, X, Activity, ArrowRight, Gem } from 'lucide-react';
import { Link } from 'react-router-dom';
import { truncateAddress, timeAgo } from '../utils/format';

interface ActivityItemProps {
  item: any;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ item }) => {
  const config: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    sale:     { icon: <Tag className="w-3 h-3" />,            label: 'Sale',       color: 'text-dream-cyan' },
    list:     { icon: <Sparkles className="w-3 h-3" />,       label: 'Listed',     color: 'text-dream-cyan' },
    transfer: { icon: <ArrowLeftRight className="w-3 h-3" />, label: 'Transfer',   color: 'text-white/40' },
    cancel:   { icon: <X className="w-3 h-3" />,              label: 'Cancelled',  color: 'text-white/30' },
    mint:     { icon: <Gem className="w-3 h-3" />,            label: 'Mint',       color: 'text-emerald-400' },
  };
  const { icon, label, color } = config[item.type] ?? { icon: <Activity className="w-3 h-3" />, label: item.type, color: 'text-white/30' };

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all">
      {/* Token image */}
      <div className="w-8 h-8 rounded-md bg-white/[0.04] flex-shrink-0 overflow-hidden border border-white/[0.08]" style={{ imageRendering: 'pixelated' }}>
        <img
          src={item.image_data || '/collections/whale-town/collection_image.png'}
          className="w-full h-full object-cover"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider ${color}`}>
            {icon}{label}
          </span>
          <span className="font-mono text-[10px] text-white/60 font-bold">#{item.token_id}</span>
          <span className="font-mono text-[9px] text-white/20 ml-auto flex-shrink-0">{timeAgo(Number(item.timestamp))}</span>
          {item.price && (
            <span className="font-mono text-[10px] font-bold text-dream-cyan flex-shrink-0">${(Number(item.price)/1e6).toFixed(2)}</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <Link to={`/profile/${item.from}`} onClick={e => e.stopPropagation()} className="text-[9px] font-mono text-white/30 hover:text-dream-cyan transition-colors truncate">{truncateAddress(item.from || '')}</Link>
          {item.to && (
            <>
              <ArrowRight className="w-2 h-2 text-white/15 flex-shrink-0" />
              <Link to={`/profile/${item.to}`} onClick={e => e.stopPropagation()} className="text-[9px] font-mono text-white/30 hover:text-dream-cyan transition-colors truncate">{truncateAddress(item.to)}</Link>
            </>
          )}
          {!item.to && item.type === 'list' && <span className="text-[9px] font-mono text-white/20">Market</span>}
        </div>
      </div>
    </div>
  );
};

export default ActivityItem;
