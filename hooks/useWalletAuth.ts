'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';

const AUTH_MESSAGE = 'Your signature verifies wallet ownership for AgoráX sign-in. This does not cost any gas or submit a transaction.';
const STORAGE_KEY = 'agorax-sessions'; // Now stores multiple sessions
const PROMPTED_KEY = 'agorax-auth-prompted'; // Tracks wallets we've already prompted

interface StoredSessions {
  [wallet: string]: string; // wallet address (lowercase) -> token
}

function getStoredSessions(): StoredSessions {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredSessions;
  } catch {
    return {};
  }
}

function getSessionForWallet(wallet: string): string | null {
  const sessions = getStoredSessions();
  return sessions[wallet.toLowerCase()] || null;
}

function storeSessionForWallet(wallet: string, token: string) {
  const sessions = getStoredSessions();
  sessions[wallet.toLowerCase()] = token;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function getPromptedWallets(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PROMPTED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markWalletPrompted(wallet: string) {
  const prompted = getPromptedWallets();
  prompted.add(wallet.toLowerCase());
  localStorage.setItem(PROMPTED_KEY, JSON.stringify([...prompted]));
}

function hasWalletBeenPrompted(wallet: string): boolean {
  return getPromptedWallets().has(wallet.toLowerCase());
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
  // Sessions are stored per-wallet, so switching wallets won't lose previous sessions
  useEffect(() => {
    if (!address) {
      setSessionToken(null);
      setIsInitialized(true);
      return;
    }

    const token = getSessionForWallet(address);
    // Validate token format is correct for this wallet
    if (token && isValidTokenFormat(token, address)) {
      setSessionToken(token);
    } else {
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
    const existingToken = getSessionForWallet(address);
    if (existingToken && isValidTokenFormat(existingToken, address)) {
      setSessionToken(existingToken);
      return existingToken;
    }

    // Mark as prompted before showing popup so we don't re-prompt on dismiss
    markWalletPrompted(address);

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
        // Store token for this wallet (keeps other wallet sessions intact)
        storeSessionForWallet(address, result.token);
        setSessionToken(result.token);
        return result.token;
      }

      return null;
    } catch {
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
    const token = getSessionForWallet(address);
    return !!(token && isValidTokenFormat(token, address));
  })();

  // Check if we've already prompted this wallet (even if they dismissed)
  const hasBeenPrompted = address ? hasWalletBeenPrompted(address) : false;

  return {
    sessionToken,
    isVerified: !!sessionToken || hasStoredSession,
    isVerifying,
    isInitialized,
    hasStoredSession, // Expose this so ConnectButton can skip prompts for returning users
    hasBeenPrompted, // True if we've already shown the sign popup for this wallet
    verify,
  };
}
