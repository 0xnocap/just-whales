import React from 'react';
import { Activity, X } from 'lucide-react';
import ActivityFeed from './ActivityFeed';

interface ActivitySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const ActivitySidebar: React.FC<ActivitySidebarProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="w-72 flex-shrink-0 bg-white/[0.02] border border-white/[0.06] rounded-xl self-start sticky top-28 h-[calc(100vh-120px)] flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-dream-cyan" />
          <h2 className="text-[10px] font-mono font-bold text-white uppercase tracking-[0.2em]">Live Activity</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-white/30 hover:text-white transition-all cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-hidden p-1.5">
        <ActivityFeed compact />
      </div>
    </div>
  );
};

export default ActivitySidebar;
