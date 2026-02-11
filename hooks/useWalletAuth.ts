'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';

const AUTH_MESSAGE = 'Verify AgoráX wallet ownership';
const STORAGE_KEY = 'agorax-session';

interface StoredSession {
  token: string;
  wallet: string;
}

function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session: StoredSession = JSON.parse(raw);
    if (!session.token || !session.wallet) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function storeSession(session: StoredSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/**
 * Validate the token format matches what we expect: wallet:hmac
 * We can't verify the HMAC client-side (no secret), but we can check format.
 */
function isValidTokenFormat(token: string, wallet: string): boolean {
  if (!token || !wallet) return false;
  const parts = token.split(':');
  if (parts.length !== 2) return false;
  // Token should start with the wallet address (lowercase)
  return parts[0] === wallet.toLowerCase() && parts[1].length === 64;
}

export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const verifyingRef = useRef(false);

  // Restore session from localStorage on mount / wallet change
  // This runs first and sets isInitialized when done
  useEffect(() => {
    if (!address) {
      setSessionToken(null);
      setIsInitialized(true);
      return;
    }

    const stored = getStoredSession();
    // Validate both wallet match AND token format is correct
    if (stored && stored.wallet === address.toLowerCase() && isValidTokenFormat(stored.token, address)) {
      setSessionToken(stored.token);
    } else {
      // Clear invalid session
      if (stored) {
        localStorage.removeItem(STORAGE_KEY);
      }
      setSessionToken(null);
    }
    setIsInitialized(true);
  }, [address]);

  // Reset state when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setSessionToken(null);
    }
  }, [isConnected]);

  const verify = useCallback(async (): Promise<string | null> => {
    if (!address) return null;
    if (verifyingRef.current) return null; // Prevent concurrent verification

    // Check stored session first - if valid, skip signature prompt
    const stored = getStoredSession();
    if (stored && stored.wallet === address.toLowerCase() && isValidTokenFormat(stored.token, address)) {
      setSessionToken(stored.token);
      return stored.token;
    }

    verifyingRef.current = true;
    setIsVerifying(true);
    try {
      // Ask the user to sign the message
      const signature = await signMessageAsync({ message: AUTH_MESSAGE });

      // Send to backend for verification and token creation
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: address,
          signature,
        }),
      });

      const result = await response.json();

      if (result.success && result.token) {
        const session: StoredSession = {
          token: result.token,
          wallet: address.toLowerCase(),
        };
        storeSession(session);
        setSessionToken(result.token);
        return result.token;
      }

      console.error('Auth verification failed:', result.error);
      return null;
    } catch (error) {
      // User rejected the signature or network error
      console.error('Wallet auth error:', error);
      return null;
    } finally {
      verifyingRef.current = false;
      setIsVerifying(false);
    }
  }, [address, signMessageAsync]);

  // Check localStorage synchronously - used to determine if we should prompt for verification
  // This is separate from isVerified to avoid race conditions
  const hasStoredSession = (() => {
    if (!address) return false;
    const stored = getStoredSession();
    return !!(stored && stored.wallet === address.toLowerCase() && isValidTokenFormat(stored.token, address));
  })();

  return {
    sessionToken,
    isVerified: !!sessionToken || hasStoredSession,
    isVerifying,
    isInitialized,
    hasStoredSession, // Expose this so ConnectButton can skip prompts for returning users
    verify,
  };
}
