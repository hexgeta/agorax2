/**
 * Client-side wallet hashing using Web Crypto API (SubtleCrypto).
 * Produces the same SHA-256 hex output as the server-side hashWallet()
 * but runs entirely in the browser — the raw wallet address never
 * leaves the client for feedback operations.
 */
export async function hashWalletClient(wallet: string): Promise<string> {
  const data = new TextEncoder().encode(wallet.toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
