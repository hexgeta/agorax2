import { createHmac } from 'crypto';

// Session tokens are valid for 24 hours
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

// The message users sign to prove wallet ownership
export const AUTH_MESSAGE = 'Verify AgoráX wallet ownership';

function getSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) throw new Error('AUTH_TOKEN_SECRET env var is not set');
  return secret;
}

/**
 * Create a stateless HMAC session token for a verified wallet.
 * Format: wallet:expiry:hmac
 * No database needed — the server can verify it using the secret alone.
 */
export function createSessionToken(walletAddress: string): { token: string; expiresAt: number } {
  const wallet = walletAddress.toLowerCase();
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = `${wallet}:${expiresAt}`;
  const hmac = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return {
    token: `${payload}:${hmac}`,
    expiresAt,
  };
}

/**
 * Verify a session token and return the wallet address if valid.
 * Returns null if the token is invalid or expired.
 */
export function verifySessionToken(token: string): string | null {
  const parts = token.split(':');
  if (parts.length !== 3) return null;

  const [wallet, expiryStr, providedHmac] = parts;
  const expiry = parseInt(expiryStr, 10);

  if (isNaN(expiry) || Date.now() > expiry) return null;

  const payload = `${wallet}:${expiryStr}`;
  const expectedHmac = createHmac('sha256', getSecret()).update(payload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (expectedHmac.length !== providedHmac.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expectedHmac.length; i++) {
    mismatch |= expectedHmac.charCodeAt(i) ^ providedHmac.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  return wallet;
}
