import { useContractRead, useAccount } from 'wagmi'
import { Address } from 'viem'
import { getContractAddress } from '@/config/testing'
import { useContract } from '@/context/ContractContext'
import { getContractABI } from '@/config/abis'

export interface WhitelistedToken {
  tokenAddress: Address
  isActive: boolean
  index: number
}

export function useContractWhitelistRead() {
  const { chainId } = useAccount();
  const { activeContract } = useContract();
  const contractAddress = getContractAddress(chainId, activeContract);
  const contractABI = getContractABI(activeContract);
  
  // Get the total count of whitelisted tokens
  const { data: totalCount, isLoading: isLoadingCount } = useContractRead({
    address: contractAddress as Address,
    abi: contractABI,
    functionName: 'viewCountWhitelisted',
    query: {
      enabled: !!contractAddress,
    },
  })

  // Get all whitelisted tokens (we'll fetch them in batches if needed)
  const { data: whitelistedData, isLoading: isLoadingWhitelist } = useContractRead({
    address: contractAddress as Address,
    abi: contractABI,
    functionName: 'viewWhitelisted',
    args: [0n, totalCount || 100n], // Start from 0, fetch up to totalCount or 100
    query: {
      enabled: !!contractAddress && !!totalCount && totalCount > 0n,
    },
  })

  // Process the whitelisted data to include indices
  const whitelistedTokens: WhitelistedToken[] = whitelistedData?.[0]?.map((token, index) => ({
    tokenAddress: token.tokenAddress,
    isActive: token.isActive,
    index: index
  })) || []

  // Get only active tokens
  const activeTokens = whitelistedTokens.filter(token => token.isActive)

  return {
    totalCount: totalCount ? Number(totalCount) : 0,
    whitelistedTokens,
    activeTokens,
    isLoading: isLoadingCount || isLoadingWhitelist,
  }
}

// Hook to get token info by index
export function useTokenInfoAt(index: number) {
  const { chainId } = useAccount();
  const { activeContract } = useContract();
  const contractAddress = getContractAddress(chainId, activeContract);
  const contractABI = getContractABI(activeContract);
  
  const { data, isLoading, error } = useContractRead({
    address: contractAddress as Address,
    abi: contractABI,
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
