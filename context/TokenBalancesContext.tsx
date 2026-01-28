'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits, formatEther } from 'viem';
import { TOKEN_CONSTANTS } from '@/constants/crypto';
import { useTransaction } from '@/context/TransactionContext';

// ERC20 balanceOf ABI
const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Native token addresses
const NATIVE_ADDRESSES = [
  '0x0',
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
];

function isNativeToken(address: string): boolean {
  return NATIVE_ADDRESSES.includes(address.toLowerCase());
}

interface TokenBalancesState {
  // Balances as formatted strings (for display) keyed by lowercase address
  balances: Record<string, string>;
  // Balances as bigint (for calculations) keyed by lowercase address
  rawBalances: Map<string, bigint>;
  isLoading: boolean;
  isInitialLoad: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getBalance: (address: string) => string;
  getRawBalance: (address: string) => bigint;
}

const TokenBalancesContext = createContext<TokenBalancesState | undefined>(undefined);

interface TokenBalancesProviderProps {
  children: ReactNode;
}

export function TokenBalancesProvider({ children }: TokenBalancesProviderProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { isTransactionPending } = useTransaction();

  const [balances, setBalances] = useState<Record<string, string>>({});
  const [rawBalances, setRawBalances] = useState<Map<string, bigint>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Prevent concurrent fetches
  const isFetchingRef = useRef(false);

  const fetchBalances = useCallback(async () => {
    if (!address || !publicClient || isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const newBalances: Record<string, string> = {};
      const newRawBalances = new Map<string, bigint>();

      // Get all tokens with addresses
      const tokensToFetch = TOKEN_CONSTANTS.filter(t => t.a && t.a.trim() !== '');

      // Separate native and ERC20 tokens
      const erc20Tokens = tokensToFetch.filter(t => !isNativeToken(t.a));
      const nativeToken = tokensToFetch.find(t => isNativeToken(t.a));

      // Fetch ERC20 balances in parallel
      const balancePromises = erc20Tokens.map(async (token) => {
        try {
          const balance = await publicClient.readContract({
            address: token.a as `0x${string}`,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [address],
          });
          return { token, balance: balance as bigint, success: true };
        } catch {
          return { token, balance: 0n, success: false };
        }
      });

      const results = await Promise.all(balancePromises);

      results.forEach(({ token, balance, success }) => {
        if (token?.a && success) {
          const addr = token.a.toLowerCase();
          const formatted = formatUnits(balance, token.decimals || 18);
          newBalances[addr] = formatted;
          newRawBalances.set(addr, balance);
        }
      });

      // Fetch native token (PLS) balance
      if (nativeToken?.a) {
        try {
          const nativeBalance = await publicClient.getBalance({ address });
          const addr = nativeToken.a.toLowerCase();
          newBalances[addr] = formatEther(nativeBalance);
          newRawBalances.set(addr, nativeBalance);

          // Also set for other native address formats
          NATIVE_ADDRESSES.forEach(nativeAddr => {
            newBalances[nativeAddr.toLowerCase()] = formatEther(nativeBalance);
            newRawBalances.set(nativeAddr.toLowerCase(), nativeBalance);
          });
        } catch {
          // Ignore native balance errors
        }
      }

      setBalances(newBalances);
      setRawBalances(newRawBalances);
      setIsInitialLoad(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch balances'));
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [address, publicClient]);

  // Fetch balances in background when wallet connects (non-blocking)
  useEffect(() => {
    if (!address || !isConnected) {
      // Clear balances when disconnected
      setBalances({});
      setRawBalances(new Map());
      setIsInitialLoad(true);
      return;
    }

    // Fetch immediately in background (non-blocking)
    fetchBalances();

    // Set up 5-minute interval for background refresh
    const intervalId = setInterval(fetchBalances, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [address, isConnected, fetchBalances]);

  // Track previous transaction pending state to detect when transactions complete
  const prevTransactionPendingRef = useRef(isTransactionPending);

  // Refetch balances when a transaction completes (pending goes from true to false)
  useEffect(() => {
    const wasTransactionPending = prevTransactionPendingRef.current;
    prevTransactionPendingRef.current = isTransactionPending;

    // Transaction just completed - refetch balances after a short delay
    // to allow the blockchain state to update
    if (wasTransactionPending && !isTransactionPending && address) {
      const timeoutId = setTimeout(() => {
        fetchBalances();
      }, 2000); // 2 second delay to let blockchain state settle

      return () => clearTimeout(timeoutId);
    }
  }, [isTransactionPending, address, fetchBalances]);

  // Helper to get formatted balance for an address
  const getBalance = useCallback((tokenAddress: string): string => {
    return balances[tokenAddress.toLowerCase()] || '0';
  }, [balances]);

  // Helper to get raw bigint balance for an address
  const getRawBalance = useCallback((tokenAddress: string): bigint => {
    return rawBalances.get(tokenAddress.toLowerCase()) ?? 0n;
  }, [rawBalances]);

  const value: TokenBalancesState = {
    balances,
    rawBalances,
    isLoading,
    isInitialLoad,
    error,
    refetch: fetchBalances,
    getBalance,
    getRawBalance,
  };

  return (
    <TokenBalancesContext.Provider value={value}>
      {children}
    </TokenBalancesContext.Provider>
  );
}

export function useTokenBalances() {
  const context = useContext(TokenBalancesContext);
  if (context === undefined) {
    throw new Error('useTokenBalances must be used within a TokenBalancesProvider');
  }
  return context;
}
