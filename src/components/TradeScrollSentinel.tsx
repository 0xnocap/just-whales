import React, { useEffect, useRef } from 'react';

const TradeScrollSentinel = ({
  loadingMore, loadingFiltered, activeFilterCount, sort,
  nextIdAsc, nextIdDesc, totalMinted,
  loadBatchAsc, loadBatchDesc, loadMoreFiltered,
  setLoadingMore, loadingMoreRef,
}: any) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingMoreRef.current) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
        const doLoad = async () => {
          try {
            if (activeFilterCount > 0) {
              await loadMoreFiltered();
            } else {
              if (sort === 'id_asc') {
                await loadBatchAsc(nextIdAsc, totalMinted);
              } else {
                await loadBatchDesc(nextIdDesc);
              }
            }
          } finally {
            setLoadingMore(false);
            loadingMoreRef.current = false;
          }
        };
        doLoad();
      }
    }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadingMore, loadingFiltered, activeFilterCount, sort, nextIdAsc, nextIdDesc, totalMinted]);

  return <div ref={sentinelRef} className="h-1 w-full" />;
};

export default TradeScrollSentinel;
