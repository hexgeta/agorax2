import { Address, parseUnits } from 'viem'
import { useContractWrite, useAccount, useReadContract } from 'wagmi'

// Standard ERC20 ABI for approval functions
const ERC20_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const

export function useTokenApproval(tokenAddress: Address, spenderAddress: Address, amount: bigint) {
  const { address } = useAccount()
  
  // Check current allowance - only if we have valid parameters
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, spenderAddress] : undefined,
    query: {
      enabled: !!address && !!tokenAddress && !!spenderAddress && tokenAddress !== '0x0000000000000000000000000000000000000000' && amount > 0n
    }
  })

  // Approve function
  const { writeContractAsync: approve, isPending: isApproving } = useContractWrite()

  const needsApproval = tokenAddress === '0x0000000000000000000000000000000000000000' || amount === 0n ? false : (allowance !== undefined ? allowance < amount : true)
  const isApproved = tokenAddress === '0x0000000000000000000000000000000000000000' || amount === 0n ? true : (allowance !== undefined && allowance >= amount)

  const approveToken = async () => {
    console.log('approveToken called with:', {
      tokenAddress,
      spenderAddress,
      amount: amount.toString(),
      hasValidTokenAddress: tokenAddress !== '0x0000000000000000000000000000000000000000',
      hasValidSpenderAddress: spenderAddress !== '0x0000000000000000000000000000000000000000',
      hasValidAmount: amount > 0n
    });

    if (!tokenAddress || !spenderAddress || !amount || tokenAddress === '0x0000000000000000000000000000000000000000' || amount === 0n) {
      throw new Error('Missing required parameters for approval')
    }

    if (spenderAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Cannot approve to zero address')
    }

    try {
      const txHash = await approve({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
        gas: 100000n // Standard gas limit for approval
      })
      
      console.log('Approval transaction submitted:', txHash);
      
      // Refetch allowance after approval
      await refetchAllowance()
      
      return txHash;
    } catch (error) {
      console.error('Token approval failed:', error)
      throw error
    }
  }

  return {
    allowance,
    needsApproval,
    isApproved,
    isApproving,
    approveToken,
    refetchAllowance
  }
}

// Helper function to check if an address is the native token
export function isNativeToken(address: string): boolean {
  const nativeAddresses = ['0x0', '0x0000000000000000000000000000000000000000', '0x000000000000000000000000000000000000dead']
  return nativeAddresses.includes(address.toLowerCase())
}
