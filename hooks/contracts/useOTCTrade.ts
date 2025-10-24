import { useContractRead, useAccount } from 'wagmi';
import { parseEther, formatEther, Address } from 'viem';
import { useContractWhitelist } from './useContractWhitelist';
import { getContractAddress } from '@/config/testing';
import { useContract } from '@/context/ContractContext';
import { getContractABI } from '@/config/abis';

export interface OrderDetails {
  sellToken: Address;
  sellAmount: bigint;
  buyTokensIndex: bigint[];
  buyAmounts: bigint[];
  expirationTime: bigint;
}

export function useOTCTrade() {
  const { address, chainId } = useAccount();
  const { activeContract } = useContract();
  
  // Get the contract address and ABI for the current chain and active contract
  const contractAddress = getContractAddress(chainId, activeContract);
  const contractABI = getContractABI(activeContract);
  
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
    abi: contractABI,
    functionName: 'getOrderCounter',
    query: {
      enabled: !!contractAddress,
    },
  });

  return {
    ordersCount: ordersCount as bigint,
    placeOrder,
    // Use the unified function that works for both contracts
    fillOrExecuteOrder,
    // Provide individual functions for flexibility
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
    activeContract,
  };
}

