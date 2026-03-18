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

/**
 * Convert a wallet hash into a display name like "User #3847".
 * Deterministic: same hash always gives the same number.
 */
export function hashToDisplayName(hash: string): string {
  const num = parseInt(hash.slice(0, 8), 16) % 10000;
  return `User #${num}`;
}
