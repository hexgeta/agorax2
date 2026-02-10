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

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const verifyAttempted = useRef<string | null>(null);

  // Restore session from localStorage on mount / wallet change
  useEffect(() => {
    if (!address) {
      setSessionToken(null);
      return;
    }

    const stored = getStoredSession();
    if (stored && stored.wallet === address.toLowerCase()) {
      setSessionToken(stored.token);
    } else {
      setSessionToken(null);
    }
  }, [address]);

  // Clear session when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      clearSession();
      setSessionToken(null);
      verifyAttempted.current = null;
    }
  }, [isConnected]);

  // Auto-verify when wallet connects and no valid session exists
  useEffect(() => {
    if (!isConnected || !address) return;
    if (sessionToken) return; // Already have a valid session
    if (verifyAttempted.current === address) return; // Already tried for this wallet

    verifyAttempted.current = address;
    verify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, sessionToken]);

  const verify = useCallback(async (): Promise<string | null> => {
    if (!address) return null;

    // Check stored session first
    const stored = getStoredSession();
    if (stored && stored.wallet === address.toLowerCase()) {
      setSessionToken(stored.token);
      return stored.token;
    }

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
      setIsVerifying(false);
    }
  }, [address, signMessageAsync]);

  return {
    sessionToken,
    isVerified: !!sessionToken,
    isVerifying,
    verify,
  };
}
