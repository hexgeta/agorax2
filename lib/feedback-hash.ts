import { createHash } from 'crypto';

/**
 * Hash a wallet address into a deterministic anonymous identifier.
 * Used for storing in the database — the raw wallet is never persisted.
 * Same wallet always produces the same hash, enabling vote deduplication
 * and consistent user identity without exposing the address.
 */
export function hashWallet(wallet: string): string {
  return createHash('sha256').update(wallet.toLowerCase()).digest('hex');
}

// 80 adjectives × 80 nouns = 6,400 unique anonymous names
const ADJECTIVES = [
  'blue', 'red', 'green', 'pink', 'gold', 'silver', 'purple', 'orange',
  'amber', 'coral', 'cyan', 'jade', 'ruby', 'lime', 'mint', 'plum',
  'swift', 'bold', 'calm', 'keen', 'warm', 'cool', 'wild', 'free',
  'bright', 'dark', 'soft', 'loud', 'quick', 'slow', 'tall', 'tiny',
  'lucky', 'happy', 'brave', 'wise', 'noble', 'quiet', 'proud', 'vivid',
  'crisp', 'fresh', 'sunny', 'misty', 'dusty', 'frosty', 'stormy', 'windy',
  'cosmic', 'lunar', 'solar', 'polar', 'tropic', 'arctic', 'rustic', 'mystic',
  'rapid', 'steady', 'gentle', 'fierce', 'silent', 'hidden', 'ancient', 'modern',
  'clever', 'witty', 'nimble', 'agile', 'daring', 'humble', 'mellow', 'zesty',
  'neon', 'ivory', 'scarlet', 'velvet', 'crystal', 'shadow', 'ember', 'steel',
];

const NOUNS = [
  'lemon', 'bird', 'wolf', 'bear', 'fox', 'hawk', 'owl', 'lion',
  'tiger', 'eagle', 'raven', 'swan', 'crane', 'panda', 'otter', 'whale',
  'coral', 'river', 'flame', 'stone', 'cloud', 'storm', 'frost', 'spark',
  'comet', 'star', 'moon', 'sun', 'dawn', 'dusk', 'peak', 'reef',
  'lotus', 'maple', 'cedar', 'pine', 'oak', 'fern', 'ivy', 'sage',
  'arrow', 'shield', 'blade', 'crown', 'tower', 'bridge', 'forge', 'nexus',
  'pulse', 'wave', 'tide', 'gale', 'bolt', 'flare', 'prism', 'vortex',
  'falcon', 'cobra', 'viper', 'lynx', 'bison', 'mantis', 'phoenix', 'dragon',
  'pixel', 'orbit', 'cipher', 'rune', 'echo', 'atlas', 'nova', 'quartz',
  'badger', 'heron', 'finch', 'robin', 'trout', 'shark', 'crab', 'moth',
];

/**
 * Convert a wallet hash into a fun anonymous display name like "BlueLemon".
 * Deterministic: same hash always gives the same name.
 */
export function hashToDisplayName(hash: string): string {
  const adjIdx = parseInt(hash.slice(0, 4), 16) % ADJECTIVES.length;
  const nounIdx = parseInt(hash.slice(4, 8), 16) % NOUNS.length;
  const suffix = parseInt(hash.slice(8, 12), 16) % 100;
  const adj = ADJECTIVES[adjIdx];
  const noun = NOUNS[nounIdx];
  return capitalize(adj) + capitalize(noun) + suffix;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Check if a raw wallet address is an admin.
 */
export function isAdminWallet(wallet: string): boolean {
  const raw = process.env.ADMIN_WALLETS || '';
  const admins = raw.split(',').map((w: string) => w.trim().toLowerCase()).filter(Boolean);
  return admins.includes(wallet.toLowerCase());
}
