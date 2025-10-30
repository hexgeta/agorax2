import { useContractRead, useAccount } from 'wagmi';
import { parseEther, formatEther, Address } from 'viem';
import { useContractWhitelist } from './useContractWhitelist';
import { getContractAddress } from '@/config/testing';
import { CONTRACT_ABI } from '@/config/abis';

export interface OrderDetails {
  sellToken: Address;
  sellAmount: bigint;
  buyTokensIndex: bigint[];
  buyAmounts: bigint[];
  expirationTime: bigint;
}

export function useOTCTrade() {
  const { address, chainId } = useAccount();
  
  // Get the contract address for the current chain
  const contractAddress = getContractAddress(chainId);
  
  // Use the whitelist system for write functions
  const {
    placeOrder,
    fillOrExecuteOrder,
    executeOrder,
    fillOrder,
    cancelOrder,
    redeemOrder,
    cancelAllExpiredOrders,
    isWalletConnected,
    isConnected
  } = useContractWhitelist();

  // Read functions - only if we have a valid contract address
  const { data: ordersCount } = useContractRead({
    address: contractAddress as Address,
    abi: CONTRACT_ABI,
    functionName: 'getOrderCounter',
    query: {
      enabled: !!contractAddress,
    },
  });

  return {
    ordersCount: ordersCount as bigint,
    placeOrder,
    fillOrExecuteOrder,
    executeOrder,
    fillOrder,
    cancelOrder,
    redeemOrder,
    cancelAllExpiredOrders,
    userAddress: address,
    isWalletConnected,
    isConnected,
    contractAddress,
    chainId,
  };
}

