import { useContractRead, useAccount } from 'wagmi'
import { Address } from 'viem'
import { getContractAddress } from '@/config/testing'
import { CONTRACT_ABI } from '@/config/abis'

export interface WhitelistedToken {
  tokenAddress: Address
  index: number
}

export function useContractWhitelistRead() {
  const { chainId } = useAccount();
  const contractAddress = getContractAddress(chainId);
  
  // Get all active whitelisted tokens directly from contract
  // Using viewActiveWhitelisted which returns only active tokens (no filtering needed)
  const { data: activeWhitelistData, isLoading } = useContractRead({
    address: contractAddress as Address,
    abi: CONTRACT_ABI,
    functionName: 'viewActiveWhitelisted',
    args: [0n, 1000n], // Start from 0, fetch up to 1000 (will return all available)
    query: {
      enabled: !!contractAddress,
    },
  })

  // Process the active token addresses to include indices
  const activeTokens: WhitelistedToken[] = activeWhitelistData?.[0]?.map((tokenAddress, index) => ({
    tokenAddress: tokenAddress as Address,
    index: index
  })) || []

  return {
    activeTokens,
    isLoading,
  }
}

// Hook to get token info by index
export function useTokenInfoAt(index: number) {
  const { chainId } = useAccount();
  const contractAddress = getContractAddress(chainId);
  
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
