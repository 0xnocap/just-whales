export interface FishType {
  id: string;
  name: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Ultra Rare' | 'Legendary' | 'NFT' | 'Junk';
  value: number;
  color: string;
  icon: string;
  nftTier?: 'Common' | 'Rare' | 'Ultra Rare' | 'Legendary';
}

export const OCEAN_TREASURES: FishType[] = [
  { id: 'pirates-cutlass', name: "Pirate's Cutlass", rarity: 'Epic', value: 200, color: 'text-slate-300', icon: '🗡️' },
  { id: 'davy-jones-locket', name: "Davy Jones' Locket", rarity: 'Legendary', value: 500, color: 'text-emerald-700', icon: '🪬' },
  { id: 'pirates-spyglass', name: "Pirate's Spyglass", rarity: 'Legendary', value: 750, color: 'text-amber-600', icon: '🔭' },
  { id: 'jolly-roger', name: 'Jolly Roger', rarity: 'Legendary', value: 1000, color: 'text-slate-100', icon: '🏴‍☠️' },
  { id: 'cursed-gold', name: 'Cursed Gold', rarity: 'Legendary', value: 1500, color: 'text-yellow-500', icon: '💰' },
];

export const FISH_LIST: FishType[] = [
  { id: 'clownfish', name: 'Clownfish', rarity: 'Common', value: 5, color: 'text-orange-500', icon: '🤡' },
  { id: 'blue-tang', name: 'Blue Tang', rarity: 'Common', value: 5, color: 'text-blue-500', icon: '🐟' },
  { id: 'yellow-tang', name: 'Yellow Tang', rarity: 'Common', value: 5, color: 'text-yellow-400', icon: '🐠' },
  { id: 'crab', name: 'Crab', rarity: 'Common', value: 8, color: 'text-red-500', icon: '🦀' },
  { id: 'starfish', name: 'Starfish', rarity: 'Common', value: 8, color: 'text-pink-400', icon: '⭐' },
  { id: 'sea-urchin', name: 'Sea Urchin', rarity: 'Common', value: 10, color: 'text-purple-900', icon: '🦔' },
  { id: 'shrimp', name: 'Shrimp', rarity: 'Common', value: 12, color: 'text-pink-300', icon: '🦐' },
  { id: 'sardine', name: 'Sardine', rarity: 'Common', value: 4, color: 'text-slate-300', icon: '🐟' },
  { id: 'seaweed', name: 'Seaweed', rarity: 'Common', value: 2, color: 'text-green-700', icon: '🌿' },
  { id: 'sand-dollar', name: 'Sand Dollar', rarity: 'Common', value: 15, color: 'text-orange-100', icon: '🪙' },
  { id: 'old-boot', name: 'Old Boot', rarity: 'Junk', value: 1, color: 'text-amber-900', icon: '🥾' },
  { id: 'rubber-duck', name: 'Rubber Duck', rarity: 'Junk', value: 2, color: 'text-yellow-500', icon: '🦆' },
  { id: 'rusty-anchor', name: 'Rusty Anchor', rarity: 'Junk', value: 5, color: 'text-orange-900', icon: '⚓' },
  { id: 'message-bottle', name: 'Bottle', rarity: 'Junk', value: 10, color: 'text-blue-100', icon: '🍾' },
  { id: 'plastic-bag', name: 'Plastic Bag', rarity: 'Junk', value: 0, color: 'text-slate-200', icon: '🛍️' },
  { id: 'fishing-net', name: 'Tangled Net', rarity: 'Junk', value: 3, color: 'text-slate-400', icon: '🕸️' },
  { id: 'butterfly-fish', name: 'Butterfly Fish', rarity: 'Uncommon', value: 15, color: 'text-yellow-200', icon: '🦋' },
  { id: 'angelfish', name: 'Angelfish', rarity: 'Uncommon', value: 15, color: 'text-purple-400', icon: '👼' },
  { id: 'jellyfish', name: 'Jellyfish', rarity: 'Uncommon', value: 20, color: 'text-blue-200', icon: '🪼' },
  { id: 'seahorse', name: 'Seahorse', rarity: 'Uncommon', value: 25, color: 'text-green-400', icon: '🎠' },
  { id: 'tuna', name: 'Tuna', rarity: 'Uncommon', value: 30, color: 'text-blue-700', icon: '🍣' },
  { id: 'salmon', name: 'Salmon', rarity: 'Uncommon', value: 35, color: 'text-orange-300', icon: '🍣' },
  { id: 'squid', name: 'Squid', rarity: 'Uncommon', value: 40, color: 'text-pink-600', icon: '🦑' },
  { id: 'flying-fish', name: 'Flying Fish', rarity: 'Uncommon', value: 45, color: 'text-cyan-200', icon: '🕊️' },
  { id: 'lionfish', name: 'Lionfish', rarity: 'Rare', value: 50, color: 'text-red-400', icon: '🦁' },
  { id: 'moorish-idol', name: 'Moorish Idol', rarity: 'Rare', value: 50, color: 'text-gray-400', icon: '🗿' },
  { id: 'octopus', name: 'Octopus', rarity: 'Rare', value: 75, color: 'text-purple-600', icon: '🐙' },
  { id: 'stingray', name: 'Stingray', rarity: 'Rare', value: 80, color: 'text-slate-400', icon: '🪁' },
  { id: 'lobster', name: 'Lobster', rarity: 'Rare', value: 90, color: 'text-red-700', icon: '🦞' },
  { id: 'moray-eel', name: 'Moray Eel', rarity: 'Rare', value: 100, color: 'text-green-800', icon: '🐍' },
  { id: 'pufferfish', name: 'Pufferfish', rarity: 'Rare', value: 110, color: 'text-yellow-600', icon: '🐡' },
  { id: 'sea-dragon', name: 'Sea Dragon', rarity: 'Rare', value: 130, color: 'text-emerald-400', icon: '🐉' },
  { id: 'manta-ray', name: 'Manta Ray', rarity: 'Epic', value: 150, color: 'text-blue-800', icon: '🪁' },
  { id: 'dolphin', name: 'Dolphin', rarity: 'Epic', value: 250, color: 'text-cyan-400', icon: '🐬' },
  { id: 'turtle', name: 'Sea Turtle', rarity: 'Epic', value: 300, color: 'text-emerald-600', icon: '🐢' },
  { id: 'swordfish', name: 'Swordfish', rarity: 'Epic', value: 350, color: 'text-blue-900', icon: '⚔️' },
  { id: 'narwhal', name: 'Narwhal', rarity: 'Epic', value: 400, color: 'text-slate-200', icon: '🦄' },
  { id: 'sunfish', name: 'Sunfish', rarity: 'Epic', value: 450, color: 'text-gray-300', icon: '☀️' },
  { id: 'megalodon-tooth', name: 'Megalodon Tooth', rarity: 'Epic', value: 500, color: 'text-slate-400', icon: '🦷' },
  { id: 'giant-squid', name: 'Giant Squid', rarity: 'Legendary', value: 2000, color: 'text-red-900', icon: '🦑' },
  { id: 'kraken-tentacle', name: 'Kraken', rarity: 'Legendary', value: 2500, color: 'text-purple-900', icon: '🐙' },
  { id: 'nft-common', name: 'Barnacle Key', rarity: 'NFT', nftTier: 'Common', value: 0, color: 'text-slate-400', icon: '🔑' },
  { id: 'nft-rare', name: 'Sunken Compass', rarity: 'NFT', nftTier: 'Rare', value: 0, color: 'text-blue-400', icon: '🧭' },
  { id: 'nft-ultra', name: 'Ancient Pearl', rarity: 'NFT', nftTier: 'Ultra Rare', value: 0, color: 'text-purple-400', icon: '🔮' },
  { id: 'nft-legendary', name: 'Ocean King Crown', rarity: 'NFT', nftTier: 'Legendary', value: 0, color: 'text-yellow-500', icon: '👑' },
  { id: 'mackerel', name: 'Mackerel', rarity: 'Common', value: 6, color: 'text-slate-400', icon: '🐟' },
  { id: 'cod', name: 'Cod', rarity: 'Common', value: 7, color: 'text-amber-100', icon: '🐟' },
  { id: 'sea-bass', name: 'Sea Bass', rarity: 'Uncommon', value: 18, color: 'text-green-900', icon: '🐟' },
  { id: 'snapper', name: 'Snapper', rarity: 'Uncommon', value: 22, color: 'text-red-300', icon: '🐟' },
  { id: 'barracuda', name: 'Barracuda', rarity: 'Rare', value: 65, color: 'text-slate-600', icon: '🐟' },
  { id: 'sturgeon', name: 'Sturgeon', rarity: 'Rare', value: 85, color: 'text-stone-500', icon: '🐟' },
  { id: 'grouper', name: 'Grouper', rarity: 'Rare', value: 95, color: 'text-emerald-900', icon: '🐟' },
  { id: 'marlin', name: 'Marlin', rarity: 'Epic', value: 280, color: 'text-blue-600', icon: '🐟' },
  { id: 'sailfish', name: 'Sailfish', rarity: 'Epic', value: 320, color: 'text-indigo-400', icon: '🐟' },
  { id: 'eagle-ray', name: 'Eagle Ray', rarity: 'Rare', value: 70, color: 'text-blue-300', icon: '🪁' },
  { id: 'soda-can', name: 'Soda Can', rarity: 'Junk', value: 0, color: 'text-red-600', icon: '🥤' },
  { id: 'glass-bottle', name: 'Glass Bottle', rarity: 'Junk', value: 1, color: 'text-blue-200', icon: '🍾' },
  { id: 'old-tire', name: 'Old Tire', rarity: 'Junk', value: 0, color: 'text-slate-800', icon: '🛞' },
  { id: 'old-map', name: 'Old Map', rarity: 'Junk', value: 5, color: 'text-yellow-100', icon: '📜' },
  { id: 'driftwood', name: 'Driftwood', rarity: 'Junk', value: 2, color: 'text-amber-700', icon: '🪵' },
  { id: 'skeleton-key', name: 'Skeleton Key', rarity: 'Junk', value: 15, color: 'text-slate-500', icon: '🗝️' },
  { id: 'broken-compass', name: 'Broken Compass', rarity: 'Junk', value: 3, color: 'text-slate-400', icon: '🧭' },
  { id: 'rusty-hook', name: 'Rusty Hook', rarity: 'Junk', value: 1, color: 'text-slate-500', icon: '🪝' },
  { id: 'lost-ring', name: 'Lost Ring', rarity: 'Rare', value: 150, color: 'text-yellow-400', icon: '💍' },
  { id: 'treasure-chest', name: 'Sunken Chest', rarity: 'Epic', value: 500, color: 'text-amber-600', icon: '📦' },
  { id: 'sea-cucumber', name: 'Sea Cucumber', rarity: 'Junk', value: 2, color: 'text-green-600', icon: '🥒' },
  { id: 'coral-fragment', name: 'Coral Fragment', rarity: 'Common', value: 6, color: 'text-pink-400', icon: '🪸' },
  { id: 'parrotfish', name: 'Parrotfish', rarity: 'Common', value: 11, color: 'text-emerald-400', icon: '🦜' },
  { id: 'nautilus', name: 'Nautilus', rarity: 'Uncommon', value: 28, color: 'text-amber-200', icon: '🐚' },
  { id: 'mantis-shrimp', name: 'Mantis Shrimp', rarity: 'Uncommon', value: 38, color: 'text-cyan-300', icon: '🥊' },
  { id: 'blobfish', name: 'Blobfish', rarity: 'Rare', value: 72, color: 'text-pink-300', icon: '🫠' },
  { id: 'anglerfish', name: 'Anglerfish', rarity: 'Rare', value: 88, color: 'text-indigo-800', icon: '🔦' },
  { id: 'giant-isopod', name: 'Giant Isopod', rarity: 'Epic', value: 300, color: 'text-slate-300', icon: '🪲' },
  { id: 'oarfish', name: 'Oarfish', rarity: 'Legendary', value: 1750, color: 'text-silver-400', icon: '🐟' },
  ...OCEAN_TREASURES,
];

export const TACKLE_BOX_COST = 125;
export const TACKLE_BOX_ATTEMPTS = 10;
export const FREE_DAILY_ATTEMPTS = 10;
