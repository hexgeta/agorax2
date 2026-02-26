import { useContractRead, useAccount } from 'wagmi'
import { Address } from 'viem'
import { getContractAddress } from '@/config/testing'
import { CONTRACT_ABI } from '@/config/abis'
import { useMemo } from 'react'
import { setWhitelistCache } from '@/utils/tokenUtils'

export interface WhitelistedToken {
  tokenAddress: Address
  index: number
}

export function useContractWhitelistRead() {
  const { chainId } = useAccount();
  // Default to PulseChain mainnet (369) when no wallet connected to enable token lookups
  const effectiveChainId = chainId || 369;
  const contractAddress = getContractAddress(effectiveChainId);

  // Get ALL whitelisted tokens to preserve correct indices for order lookups
  // viewWhitelisted returns TokenInfo[] with {tokenAddress, isActive}
  const { data: whitelistData, isLoading } = useContractRead({
    address: contractAddress as Address,
    abi: CONTRACT_ABI,
    functionName: 'viewWhitelisted',
    args: [0n, 1000n], // Start from 0, fetch up to 1000
    query: {
      enabled: !!contractAddress,
    },
  })

  // Filter to only active tokens for dropdowns, preserving original indices
  // Also populate the whitelist cache synchronously during render so getTokenInfoByIndex
  // has data available before any component reads from it (useEffect would run too late)
  const activeTokens: WhitelistedToken[] = useMemo(() => {
    if (whitelistData?.[0] && whitelistData[0].length > 0) {
      const addresses = whitelistData[0].map((t: { tokenAddress: Address }) => t.tokenAddress as string);
      setWhitelistCache(addresses);
    }

    return whitelistData?.[0]
      ?.map((t: { tokenAddress: Address; isActive: boolean }, index: number) => ({
        tokenAddress: t.tokenAddress as Address,
        index: index,
        isActive: t.isActive
      }))
      .filter((t: { isActive: boolean }) => t.isActive) ?? [];
  }, [whitelistData]);

  return {
    activeTokens,
    isLoading,
  }
}

// Hook to get token info by index
export function useTokenInfoAt(index: number) {
  const { chainId } = useAccount();
  // Default to PulseChain mainnet (369) when no wallet connected
  const effectiveChainId = chainId || 369;
  const contractAddress = getContractAddress(effectiveChainId);
  
  const { data, isLoading, error } = useContractRead({
    address: contractAddress as Address,
    abi: CONTRACT_ABI,
    functionName: 'getTokenInfoAt',
    args: [BigInt(index)],
    query: {
      enabled: !!contractAddress && index >= 0,
    },
  })

  return {
    tokenAddress: data?.[0] as Address | undefined,
    isActive: data?.[1] as boolean | undefined,
    isLoading,
    error,
  }
}
