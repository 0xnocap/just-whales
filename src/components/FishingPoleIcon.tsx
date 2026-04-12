export default function FishingPoleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Pole */}
      <path d="m2 22 17-17" />
      {/* Reel */}
      <circle cx="7" cy="17" r="2" />
      <path d="m7 17 2-2" />
      {/* Line + Hook */}
      <path d="M19 5v8a3 3 0 0 1-6 0l1.5 2" />
    </svg>
  );
}
