export default function StatsSkeleton() {
  return (
    <div className="flex gap-2 mb-6 flex-wrap animate-pulse w-full">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2 flex-1 min-w-[80px]">
          <div className="h-2.5 bg-white/[0.05] rounded w-12 mb-2" />
          <div className="h-4 bg-white/[0.08] rounded w-16" />
        </div>
      ))}
    </div>
  );
}
