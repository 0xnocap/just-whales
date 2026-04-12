export default function BlockiesAvatar({ address, size = 32 }: { address: string; size?: number }) {
  // Simple deterministic color from address
  const hash = address.toLowerCase();
  const hue = parseInt(hash.slice(2, 6), 16) % 360;
  const hue2 = parseInt(hash.slice(6, 10), 16) % 360;
  return (
    <div
      className="rounded-full flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${hue2}, 70%, 40%))`,
      }}
    />
  );
}
