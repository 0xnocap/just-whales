import React, { useState, useEffect, useRef } from 'react';
import { Star, Clock } from 'lucide-react';
import { formatUnits } from 'viem';
import { imageCache, rasterizeImage } from '../utils/rasterize';
import { timeUntil } from '../utils/format';
import SkeletonCard from './SkeletonCard';

interface NFTCardProps {
  token: any;
  isListed: boolean;
  listing?: any;
  isOwner?: boolean;
  isSeller?: boolean;
  tokenOwner?: string;
  rarityRank?: number;
  onSelect: (props: any) => void;
  fetchData?: () => void;
  onBuySuccess?: () => void;
}

const NFTCard: React.FC<NFTCardProps> = ({
  token,
  isListed,
  listing,
  isOwner,
  isSeller,
  tokenOwner,
  rarityRank,
  onSelect,
  fetchData,
  onBuySuccess
}) => {
  const isCached = imageCache.has(String(token.id));
  const [rasterSrc, setRasterSrc] = useState<string | null>(isCached ? imageCache.get(String(token.id))! : null);
  const [isTimerDone, setIsTimerDone] = useState(isCached);
  const [hasBeenSeen, setHasBeenSeen] = useState(isCached);
  const cardRef = useRef<HTMLDivElement>(null);

  // Only start the 500ms timer once the card enters the viewport
  useEffect(() => {
    if (hasBeenSeen) return;
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasBeenSeen(true);
        obs.disconnect();
      }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasBeenSeen]);

  useEffect(() => {
    if (!hasBeenSeen || isTimerDone) return;
    const timer = setTimeout(() => setIsTimerDone(true), 500);
    return () => clearTimeout(timer);
  }, [hasBeenSeen, isTimerDone]);

  // Rasterize in background for scroll-back cache (non-blocking)
  // ONLY start this after the card has been seen, otherwise the initial load
  // gets locked up parsing 200+ SVG data URIs simultaneously.
  useEffect(() => {
    if (!hasBeenSeen || rasterSrc || !token.image_data) return;
    rasterizeImage(token.image_data, token.id).then(setRasterSrc);
  }, [hasBeenSeen, token.image_data, token.id, rasterSrc]);

  // Show card when timer is done — use cached raster if available, otherwise original data URI
  const isReady = isTimerDone && !!token.image_data;
  const displaySrc = rasterSrc || token.image_data;

  if (!isReady) {
    return (
      <div ref={cardRef} className="h-full relative">
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className="group relative cursor-pointer h-full"
      onClick={() => onSelect({ ...token, isListing: isListed, listingData: listing, isOwner, isSeller, ownerAddress: tokenOwner, refetch: fetchData, onBuySuccess })}
    >
      <div className="flex flex-col h-full rounded-xl overflow-hidden bg-[#111113] hover:bg-[#1a1a1c] transition-colors duration-300">
        <div className="relative w-full pb-[100%] overflow-hidden flex-shrink-0 bg-white/[0.02]">
          <img
            src={displaySrc}
            alt={token.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            style={{ imageRendering: 'pixelated' }}
          />
          
          {isListed && (
            <div className="absolute top-2 right-2 z-10 bg-dream-cyan/90 text-[#0a0a0c] px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">
              LISTED
            </div>
          )}
          {isOwner && !isListed && (
            <div className="absolute top-2 right-2 z-10 bg-dream-purple/80 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">
              OWNED
            </div>
          )}
          {rarityRank && (
            <div className="absolute bottom-2 left-2 z-10 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 text-amber-400" />
              <span className="text-[9px] font-mono text-white/70 font-bold">#{rarityRank}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col px-3 py-2.5 flex-grow">
          <div className="flex flex-col">
            <div className="flex items-baseline justify-between mb-1.5">
              <h3 className="font-sans font-bold text-white/90 text-[13px] leading-none truncate">{token.name.split(' ')[0]}</h3>
              <span className="font-mono text-[11px] text-white/30 font-medium ml-1">{token.name.split(' ')[1] || ''}</span>
            </div>
            {isListed ? (
              <div className="flex items-baseline justify-between">
                <span className="font-bold text-white text-[14px] leading-none">
                  ${Number(formatUnits(listing.price, 6)).toFixed(2)}
                </span>
                {listing.expiresAt > 0n && (
                  <span className="text-[9px] font-mono text-white/20 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />{timeUntil(Number(listing.expiresAt))}
                  </span>
                )}
              </div>
            ) : (
              <div className="h-[17px]" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NFTCard;
