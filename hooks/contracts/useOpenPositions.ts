import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, http } from 'viem';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { getContractAddress, PULSECHAIN_CHAIN_ID, PULSECHAIN_TESTNET_CHAIN_ID } from '@/config/testing';
import { CONTRACT_ABI } from '@/config/abis';

// RPC endpoints per chain
const RPC_ENDPOINTS = {
  [PULSECHAIN_CHAIN_ID]: 'https://rpc.pulsechain.com',
  [PULSECHAIN_TESTNET_CHAIN_ID]: 'https://pulsechain-testnet-rpc.publicnode.com',
};

// Type definitions that work for both contracts
export interface UserOrderDetails {
  orderIndex: bigint;
  orderOwner: Address;
}

export interface OrderDetails {
  sellToken: Address;
  sellAmount: bigint;
  buyTokensIndex: bigint[];
  buyAmounts: bigint[];
  expirationTime: bigint;
}

// Unified interface that works for both contracts
export interface OrderDetailsWithId {
  orderId: bigint;
  // Bistro uses 'remainingExecutionPercentage', AgoraX uses 'remainingFillPercentage'
  remainingExecutionPercentage?: bigint;
  remainingFillPercentage?: bigint;
  // Bistro uses 'redemeedPercentage', AgoraX uses 'redeemedPercentage'
  redemeedPercentage?: bigint;
  redeemedPercentage?: bigint;
  lastUpdateTime: number;
  status: number; // 0: Active, 1: Cancelled, 2: Completed
  orderDetails: OrderDetails;
}

export interface CompleteOrderDetails {
  userDetails: UserOrderDetails;
  orderDetailsWithId: OrderDetailsWithId;
}

// Helper function to normalize order data between contracts
function normalizeOrderData(order: any): CompleteOrderDetails {
  return {
    userDetails: order.userDetails,
    orderDetailsWithId: {
      ...order.orderDetailsWithId,
      // Normalize to use both property names for compatibility
      remainingExecutionPercentage: order.orderDetailsWithId.remainingExecutionPercentage || order.orderDetailsWithId.remainingFillPercentage,
      remainingFillPercentage: order.orderDetailsWithId.remainingFillPercentage || order.orderDetailsWithId.remainingExecutionPercentage,
      redemeedPercentage: order.orderDetailsWithId.redemeedPercentage || order.orderDetailsWithId.redeemedPercentage,
      redeemedPercentage: order.orderDetailsWithId.redeemedPercentage || order.orderDetailsWithId.redemeedPercentage,
    }
  };
}

// Helper function to create client (only on client side)
function createClient(chainId: number) {
  // Get the appropriate RPC endpoint
  const rpcUrl = RPC_ENDPOINTS[chainId as keyof typeof RPC_ENDPOINTS];
  
  if (!rpcUrl) {
    throw new Error(`No RPC endpoint configured for chain ${chainId}`);
  }
  
  // Import chains only when needed (client-side only)
  const { pulsechain } = require('viem/chains');
  
  // Use the appropriate chain config based on chainId
  const chainConfig = chainId === PULSECHAIN_CHAIN_ID ? pulsechain : {
    id: chainId,
    name: 'PulseChain Testnet v4',
    network: 'pulsechain-testnet',
    nativeCurrency: {
      decimals: 18,
      name: 'Test PLS',
      symbol: 'tPLS',
    },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
  };
  
  return createPublicClient({
    chain: chainConfig,
    transport: http(rpcUrl, {
      timeout: 10000, // 10 second timeout per call
      retryCount: 0, // Let our error handling manage retries
    })
  });
}

// Helper function to fetch contract data
async function fetchContractData(contractAddress: Address, chainId: number) {
  try {
    if (!contractAddress) {
      throw new Error('No contract address provided');
    }
    
    // Create client only when needed (client-side only)
    const client = createClient(chainId);
    
    // Test basic connectivity first
    try {
      await client.getBlockNumber();
    } catch (rpcError) {
      throw rpcError;
    }
    
    // Fetch all contract data in parallel
    const [contractName, contractOwner, contractSymbol, totalSupply, orderCounter] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'name',
      }).catch(err => {
        return null;
      }),
      
      client.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'owner',
      }).catch(err => {
        return null;
      }),
      
      client.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'symbol',
      }).catch(err => {
        return null;
      }),
      
      client.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'totalSupply',
      }).catch(err => {
        return null;
      }),
      
      client.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'getOrderCounter',
      }).catch(err => {
        return null;
      })
    ]);

    // Fetch all orders if we have an order counter
    let allOrders: CompleteOrderDetails[] = [];
    if (orderCounter && orderCounter > 0n) {
      
      // Create array of order IDs (1 to orderCounter)
      const orderIds = Array.from({ length: Number(orderCounter) }, (_, i) => i + 1);
      
      // Fetch orders in batches to avoid overwhelming the RPC
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < orderIds.length; i += batchSize) {
        batches.push(orderIds.slice(i, i + batchSize));
      }
      
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        const batchPromises = batch.map(orderId => 
          client.readContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: 'getOrderDetails',
            args: [BigInt(orderId)],
          }).catch(err => {
            return null;
          })
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        // Filter out null results, normalize, and add to allOrders
        const validOrders = batchResults
          .filter((order): order is any => order !== null)
          .map(order => normalizeOrderData(order));
        allOrders.push(...validOrders);
        
        
        // Small delay between batches to be nice to the RPC
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
    }

    // Filter orders by status
    const activeOrders = allOrders.filter(order => order.orderDetailsWithId.status === 0);
    const completedOrders = allOrders.filter(order => order.orderDetailsWithId.status === 2);
    const cancelledOrders = allOrders.filter(order => order.orderDetailsWithId.status === 1);


    const result = {
      contractName: contractName as string | null,
      contractOwner: contractOwner as Address | null,
      contractSymbol: contractSymbol as string | null,
      totalSupply: totalSupply as bigint | null,
      orderCounter: orderCounter as bigint | null,
      allOrders: allOrders,
      activeOrders: activeOrders,
      completedOrders: completedOrders,
      cancelledOrders: cancelledOrders,
    };
    
    return result;
  } catch (error) {
    return {
      contractName: null,
      contractOwner: null,
      contractSymbol: null,
      totalSupply: null,
      orderCounter: null,
      allOrders: [],
      activeOrders: [],
      completedOrders: [],
      cancelledOrders: [],
    };
  }
}

export function useOpenPositions() {
  const { chainId, isConnected } = useAccount();
  const contractAddress = getContractAddress(chainId);
  
  const [data, setData] = useState<{
    contractName: string | null;
    contractOwner: Address | null;
    contractSymbol: string | null;
    totalSupply: bigint | null;
    orderCounter: bigint | null;
    allOrders: CompleteOrderDetails[];
    activeOrders: CompleteOrderDetails[];
    completedOrders: CompleteOrderDetails[];
    cancelledOrders: CompleteOrderDetails[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isClient, setIsClient] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isClient) {
      return;
    }
    
    // Don't fetch if wallet is not connected
    if (!isConnected) {
      setIsLoading(false);
      return;
    }
    
    if (!contractAddress || !chainId) {
      setError(new Error('Contract not deployed on this chain'));
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchContractData(contractAddress as Address, chainId);
      setData(result);
      
      // If all data is null, there might be an issue
      if (!result.contractName && !result.contractOwner && !result.contractSymbol && !result.totalSupply && !result.orderCounter) {
        setError(new Error('All contract calls failed'));
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [isClient, isConnected, contractAddress, chainId]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      fetchData();
    }
  }, [isClient, fetchData]);

  return {
    contractName: data?.contractName,
    contractOwner: data?.contractOwner,
    contractSymbol: data?.contractSymbol,
    totalSupply: data?.totalSupply,
    orderCounter: data?.orderCounter,
    allOrders: data?.allOrders || [],
    activeOrders: data?.activeOrders || [],
    completedOrders: data?.completedOrders || [],
    cancelledOrders: data?.cancelledOrders || [],
    isLoading: !isClient || isLoading,
    error,
    refetch: fetchData,
  };
}
