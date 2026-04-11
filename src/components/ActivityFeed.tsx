import React from 'react';
import { ACTIVITY_FILTERS } from '../constants/activity';
import { useActivityFeed } from '../hooks/useActivityFeed';
import ActivityItem from './ActivityItem';
import type { ActivityFilterKey } from '../types';

interface ActivityFeedProps {
  compact?: boolean;
  externalFilter?: ActivityFilterKey;
  onFilterChange?: (f: ActivityFilterKey) => void;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ compact = false, externalFilter, onFilterChange }) => {
  const { filtered, loading, filter, setFilter } = useActivityFeed(externalFilter, onFilterChange);

  return (
    <div className={compact ? 'flex flex-col h-full' : ''}>
      {/* Filter chips - hide if external filters are provided (toolbar) */}
      {!externalFilter && (
        <div className="flex gap-1.5 flex-wrap mb-1.5">
          {ACTIVITY_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-lg font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer border ${
                filter === f.key
                  ? 'bg-dream-cyan/15 text-dream-cyan border-dream-cyan/30'
                  : 'bg-white/[0.03] text-white/30 border-white/[0.06] hover:text-white/60 hover:border-white/15'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className={`space-y-1.5 ${compact ? 'flex-1 overflow-y-auto custom-scrollbar' : ''}`}>
        {loading ? (
          Array.from({ length: compact ? 6 : 12 }).map((_, i) => (
            <div key={i} className="h-12 bg-white/[0.01] border border-white/[0.03] rounded-lg animate-pulse" />
          ))
        ) : filtered.length > 0 ? (
          filtered.map((item, idx) => <ActivityItem key={idx} item={item} />)
        ) : (
          <div className="text-center py-10">
            <p className="font-mono text-[9px] text-white/20 uppercase tracking-widest">No activity</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
