export default function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-[#111113] flex flex-col animate-pulse h-full">
      <div className="w-full pb-[100%] bg-white/[0.15] relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.1] to-transparent skeleton-shimmer" />
      </div>
      <div className="px-3 py-2.5 space-y-2 flex-grow">
        <div className="flex items-center justify-between">
          <div className="h-3 bg-white/[0.12] rounded w-16" />
          <div className="h-3 bg-white/[0.1] rounded w-8" />
        </div>
        <div className="h-3 bg-white/[0.1] rounded w-12" />
      </div>
    </div>
  );
}
