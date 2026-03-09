import { useEffect, useState, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { TOKEN_CONSTANTS } from '@/constants/crypto'
import { PRICE_CACHE_KEYS } from './utils/cache-keys';
import { WPLS_ADDRESS, PLS_NATIVE_ADDRESSES } from '@/utils/format';

export interface TokenPriceData {
  price: number;
  priceChange: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h6?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  liquidity?: number;
}

export interface TokenPrices {
  [ticker: string]: TokenPriceData;
}

// Essential tokens that should be loaded first
export const ESSENTIAL_TOKENS = ['PLS', 'PLSX', 'INC', 'pHEX', 'eHEX'];

const DEFAULT_PRICE_DATA: TokenPriceData = {
  price: 0,
  priceChange: {},
  liquidity: 0,
  volume: {},
  txns: {}
};

// Cache for pair address lookups to avoid repeated API calls
const pairAddressCache: { [contractAddress: string]: { pairAddress: string | null; timestamp: number } } = {};
const PAIR_CACHE_TTL = 30 * 1000; // 30 seconds

// Function to find the best pair address for a token contract
async function findBestPairAddress(contractAddress: string, chainId: number): Promise<string | null> {
  const cacheKey = `${contractAddress.toLowerCase()}_${chainId}`;
  const cached = pairAddressCache[cacheKey];

  // Return cached result if still valid
  if (cached && Date.now() - cached.timestamp < PAIR_CACHE_TTL) {
    return cached.pairAddress;
  }

  const chainName = chainId === 1 ? 'ethereum' : 'pulsechain';

  try {
    // Search for pairs containing this token
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`);

    if (!response.ok) {
      pairAddressCache[cacheKey] = { pairAddress: null, timestamp: Date.now() };
      return null;
    }

    const data = await response.json();
    const pairs = data.pairs || [];

    if (pairs.length === 0) {
      pairAddressCache[cacheKey] = { pairAddress: null, timestamp: Date.now() };
      return null;
    }

    // Filter pairs for the correct chain
    // DexScreener returns chainId as string (e.g., "pulsechain", "ethereum")
    const chainPairs = pairs.filter((pair: any) => {
      return pair.chainId === chainName;
    });

    if (chainPairs.length === 0) {
      pairAddressCache[cacheKey] = { pairAddress: null, timestamp: Date.now() };
      return null;
    }

    // Only use pairs where our token is the base token
    // DexScreener's priceUsd is the base token's price, so quote-side pairs give wrong prices
    const basePairs = chainPairs.filter((pair: any) =>
      pair.baseToken?.address?.toLowerCase() === contractAddress.toLowerCase()
    );

    if (basePairs.length === 0) {
      pairAddressCache[cacheKey] = { pairAddress: null, timestamp: Date.now() };
      return null;
    }

    // Sort by liquidity (highest first) and return the best pair
    const sortedPairs = basePairs.sort((a: any, b: any) => {
      const aLiquidity = parseFloat(a.liquidity?.usd || '0');
      const bLiquidity = parseFloat(b.liquidity?.usd || '0');
      return bLiquidity - aLiquidity;
    });

    const bestPair = sortedPairs[0].pairAddress;
    pairAddressCache[cacheKey] = { pairAddress: bestPair, timestamp: Date.now() };
    return bestPair;
  } catch (error) {
    pairAddressCache[cacheKey] = { pairAddress: null, timestamp: Date.now() };
    return null;
  }
}

// Batch fetch function for multiple pairs on the same chain
async function fetchBatchPairData(chainName: string, pairAddresses: string[]): Promise<(any | null)[]> {
  const maxBatchSize = 30; // DexScreener supports up to 30 pairs per request
  const results: (any | null)[] = [];
  
  
  // Split into batches
  for (let i = 0; i < pairAddresses.length; i += maxBatchSize) {
    const batch = pairAddresses.slice(i, i + maxBatchSize);
    const pairString = batch.join(',');
    const batchNum = Math.floor(i / maxBatchSize) + 1;
    
    
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${chainName}/${pairString}`);
      
      
      if (!response.ok) {
        // Add default data for failed batch
        results.push(...batch.map(() => null));
        continue;
      }
      
      const data = await response.json();
      const pairs = data.pairs || [];
      
      
      // Map pairs back to addresses (order might not match)
      const batchResults = batch.map(address => {
        const pair = pairs.find((p: any) => p.pairAddress?.toLowerCase() === address.toLowerCase());
        return pair || null;
      });
      
      
      results.push(...batchResults);
      
      // Add delay between batches to respect rate limits
      if (i + maxBatchSize < pairAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
      }
    } catch (error) {
      // Add default data for failed batch
      results.push(...batch.map(() => null));
    }
  }
  
  
  return results;
}

async function fetchTokenPrices(contractAddresses: string[], customTokens: any[] = []): Promise<TokenPrices> {
  const results: TokenPrices = {};

  // Group tokens by chain
  const tokensByChain: { [chain: string]: { ticker: string; contractAddress: string; pairAddress: string }[] } = {};
  
  for (const contractAddress of contractAddresses) {
    // Look for token in TOKEN_CONSTANTS and custom tokens by contract address
    const allTokens = [...TOKEN_CONSTANTS, ...customTokens];
    const tokenConfig = allTokens.find(token => 
      token.a && token.a.toLowerCase() === contractAddress.toLowerCase()
    );
    
    if (!tokenConfig) {
      // If not found in constants, create a basic config for the contract address
      const basicConfig = {
        ticker: contractAddress.slice(0, 8), // Use first 8 chars as ticker
        chain: 369, // Default to PulseChain
        dexs: '', // Will be discovered dynamically
        type: 'token'
      };
      
      // Try to find the best pair address dynamically
      const bestPairAddress = await findBestPairAddress(contractAddress, 369);
      if (bestPairAddress) {
        if (!tokensByChain['pulsechain']) {
          tokensByChain['pulsechain'] = [];
        }
        tokensByChain['pulsechain'].push({ 
          ticker: basicConfig.ticker, 
          contractAddress, 
          pairAddress: bestPairAddress 
        });
      }
      continue;
    }

    // Skip LP tokens - they should be priced via PHUX pool data, not DEX prices
    if (tokenConfig.type === 'lp') {
      continue;
    }

    // Skip farm tokens - they should be priced via LP pricing system, not DEX prices
    if (tokenConfig.type === 'farm') {
      continue;
    }

    const { chain: chainId, dexs, ticker } = tokenConfig;
    const chainName = chainId === 1 ? 'ethereum' : 'pulsechain';

    // PLS/WPLS use hardcoded pair since native gas token address can't be found on DexScreener
    // All other tokens dynamically find the best pair, falling back to hardcoded dexs
    let bestPairAddress: string | null = null;
    const isPLS = contractAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      contractAddress.toLowerCase() === '0xa1077a294dde1b09bb078844df40758a5d0f9a27';

    if (isPLS) {
      bestPairAddress = Array.isArray(dexs) ? dexs[0] : dexs;
    } else {
      bestPairAddress = await findBestPairAddress(contractAddress, chainId);
      // Fall back to hardcoded dexs if dynamic lookup fails
      if (!bestPairAddress && dexs && dexs !== '' && dexs !== '0x0' && dexs !== '0x0000000000000000000000000000000000000000') {
        bestPairAddress = Array.isArray(dexs) ? dexs[0] : dexs;
      }
    }
    
    if (!bestPairAddress) {
      // Token has no price source - add to results with null price but marked as "no price available"
      results[contractAddress] = {
        ...DEFAULT_PRICE_DATA,
        price: -1 // Use -1 to indicate "no price available" vs "price is $0"
      };
      continue;
    }
    
    if (!tokensByChain[chainName]) {
      tokensByChain[chainName] = [];
    }
    
    tokensByChain[chainName].push({ 
      ticker, 
      contractAddress, 
      pairAddress: bestPairAddress 
    });
  }

  const successfulTokens: string[] = [];
  const failedTokens: string[] = [];

  // Process each chain separately
  for (const [chainName, tokens] of Object.entries(tokensByChain)) {
    try {
      
      const pairAddresses = tokens.map(t => t.pairAddress);
      
      const pairData = await fetchBatchPairData(chainName, pairAddresses);
      
      // Map results back to contract addresses with detailed logging
      tokens.forEach((token, index) => {
        const pair = pairData[index];
        
        if (pair && pair.priceUsd) {
          // Use contract address as key instead of ticker
          // priceUsd is always correct since we only select pairs where our token is the base
          results[token.contractAddress] = {
      price: parseFloat(pair.priceUsd),
      priceChange: {
              m5: pair.priceChange?.m5,
              h1: pair.priceChange?.h1,
              h6: pair.priceChange?.h6,
              h24: pair.priceChange?.h24
      },
      volume: {
              m5: pair.volume?.m5,
              h1: pair.volume?.h1,
              h6: pair.volume?.h6,
              h24: pair.volume?.h24
      },
      txns: {
              m5: pair.txns?.m5,
              h1: pair.txns?.h1,
              h6: pair.txns?.h6,
              h24: pair.txns?.h24
            },
            liquidity: pair.liquidity?.usd
          };
          successfulTokens.push(token.contractAddress);
        } else {
          failedTokens.push(token.contractAddress);
          results[token.contractAddress] = DEFAULT_PRICE_DATA;
        }
      });
  } catch (error) {
      // Add default data for all tokens in this chain
      tokens.forEach(token => {
        failedTokens.push(token.contractAddress);
        results[token.contractAddress] = DEFAULT_PRICE_DATA;
      });
    }
  }

  // Final summary
  
  if (successfulTokens.length > 0) {
    successfulTokens.forEach(contractAddress => {
      const data = results[contractAddress];
    });
  }
  
  if (failedTokens.length > 0) {
    failedTokens.forEach(contractAddress => {
    });
  }
  

  return results;
}

// Build a compact fingerprint of price data to detect actual value changes
function buildPriceFingerprint(prices: TokenPrices): string {
  return Object.entries(prices)
    .map(([k, v]) => `${k}:${v.price}`)
    .sort()
    .join('|');
}

export function useTokenPrices(contractAddresses: string[], options?: { disableRefresh?: boolean; customTokens?: any[] }) {
  const [error, setError] = useState<Error | null>(null);
  // Stable prices ref — only updated when actual price values change
  const stablePrices = useRef<TokenPrices>({});
  const prevFingerprint = useRef('');
  const [, forceRender] = useState(0);

  // Ensure WPLS is fetched when any native PLS address is in the list
  const normalizedAddresses = useMemo(() => {
    const addresses = [...contractAddresses];
    const hasNativePLS = addresses.some(addr =>
      PLS_NATIVE_ADDRESSES.some(plsAddr => addr.toLowerCase() === plsAddr.toLowerCase())
    );
    if (hasNativePLS && !addresses.some(addr => addr.toLowerCase() === WPLS_ADDRESS)) {
      addresses.push(WPLS_ADDRESS);
    }
    return addresses;
  }, [contractAddresses]);

  // Create a unique key for this set of contract addresses
  const cacheKey = normalizedAddresses.join(',');

  const { data, error: swrError, isLoading } = useSWR(
    cacheKey ? PRICE_CACHE_KEYS.realtime(cacheKey) : null,
    async () => {
      try {
        return await fetchTokenPrices(normalizedAddresses, options?.customTokens || []);
      } catch (e) {
        setError(e as Error);
        return {};
      }
    },
    {
      refreshInterval: options?.disableRefresh ? 0 : 15000, // Disable refresh if requested
      dedupingInterval: 5000, // 5 seconds
      revalidateOnFocus: false
    }
  );

  // Only update the stable reference and trigger re-render when prices actually change
  const didChange = useRef(false);
  if (data) {
    const fingerprint = buildPriceFingerprint(data);
    if (fingerprint !== prevFingerprint.current) {
      prevFingerprint.current = fingerprint;
      stablePrices.current = data;
      didChange.current = true;
    } else {
      didChange.current = false;
    }
  }

  useEffect(() => {
    if (didChange.current) {
      forceRender(n => n + 1);
    }
  }, [data]);

  if (swrError && swrError !== error) {
    setError(swrError);
  }

  return { prices: stablePrices.current, isLoading, error };
}