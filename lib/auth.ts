import { createHmac } from 'crypto';

// The message users sign to prove wallet ownership
export const AUTH_MESSAGE = 'Your signature verifies wallet ownership for AgoráX sign-in. This does not cost any gas or submit a transaction.';

function getSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) throw new Error('AUTH_TOKEN_SECRET env var is not set');
  return secret;
}

/**
 * Create a stateless HMAC session token for a verified wallet.
 * Format: wallet:hmac
 * No expiry — valid until the user clears their cache or AUTH_TOKEN_SECRET rotates.
 */
export function createSessionToken(walletAddress: string): string {
  const wallet = walletAddress.toLowerCase();
  const hmac = createHmac('sha256', getSecret()).update(wallet).digest('hex');
  return `${wallet}:${hmac}`;
}

/**
 * Verify a session token and return the wallet address if valid.
 * Returns null if the token is invalid.
 */
export function verifySessionToken(token: string): string | null {
  const separatorIndex = token.indexOf(':');
  if (separatorIndex === -1) return null;

  const wallet = token.slice(0, separatorIndex);
  const providedHmac = token.slice(separatorIndex + 1);

  if (!wallet || !providedHmac) return null;

  const expectedHmac = createHmac('sha256', getSecret()).update(wallet).digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (expectedHmac.length !== providedHmac.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expectedHmac.length; i++) {
    mismatch |= expectedHmac.charCodeAt(i) ^ providedHmac.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  return wallet;
}
