import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, http } from 'viem';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { getContractAddress, PULSECHAIN_CHAIN_ID, PULSECHAIN_TESTNET_CHAIN_ID } from '@/config/testing';
import { CONTRACT_ABI } from '@/config/abis';

// RPC endpoints per chain
const RPC_ENDPOINTS = {
  [PULSECHAIN_CHAIN_ID]: 'https://rpc.pulsechain.com',
  [PULSECHAIN_TESTNET_CHAIN_ID]: 'https://rpc.v4.testnet.pulsechain.com',
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
  allOrNothing: boolean;
}

// AgoraX_final.sol interface
export interface OrderDetailsWithID {
  orderID: bigint;
  remainingSellAmount: bigint;
  redeemedSellAmount: bigint;
  lastUpdateTime: number;
  status: number; // 0: Active, 1: Cancelled, 2: Completed
  creationProtocolFee: bigint;
  orderDetails: OrderDetails;
}

export interface CompleteOrderDetails {
  userDetails: UserOrderDetails;
  orderDetailsWithID: OrderDetailsWithID;
}

// Helper function to cast order data to correct types
function normalizeOrderData(order: any): CompleteOrderDetails {
  return order as CompleteOrderDetails;
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

// Helper function to fetch contract data efficiently
async function fetchContractData(contractAddress: Address, chainId: number, userAddress?: Address | null) {
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
        functionName: 'getTotalOrderCount',
      }).catch(err => {
        return null;
      })
    ]);

    // Fetch orders efficiently based on whether we have a user address
    let allOrders: CompleteOrderDetails[] = [];
    
    if (userAddress) {
      // ⚡ EFFICIENT: Use user-specific queries (4 calls instead of N calls for user's own orders)
      const [openOrders, expiredOrders, completedOrders, cancelledOrders] = await Promise.all([
        client.readContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: 'viewUserOpenOrders',
          args: [userAddress, 0n, 1000n], // Fetch up to 1000 open orders
        }).catch(() => [[], 0n]),
        
        client.readContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: 'viewUserExpiredOrders',
          args: [userAddress, 0n, 1000n],
        }).catch(() => [[], 0n]),
        
        client.readContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: 'viewUserCompletedOrders',
          args: [userAddress, 0n, 1000n],
        }).catch(() => [[], 0n]),
        
        client.readContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: 'viewUserCancelledOrders',
          args: [userAddress, 0n, 1000n],
        }).catch(() => [[], 0n])
      ]);

      // Convert to CompleteOrderDetails format
      const convertOrders = (ordersArray: any) => {
        const orders = (ordersArray as any)[0] || [];
        return orders.map((orderDetailsWithID: any) => ({
          userDetails: {
            orderIndex: 0n, // Not provided by view functions
            orderOwner: userAddress,
          },
          orderDetailsWithID,
        }));
      };

      allOrders = [
        ...convertOrders(openOrders),
        ...convertOrders(expiredOrders),
        ...convertOrders(completedOrders),
        ...convertOrders(cancelledOrders),
      ];
    } else {
      // 🌐 MARKETPLACE MODE: Fetch ALL orders from all users (N calls where N = total orders)
      // This is used when userAddress is null/undefined - typically in marketplace view
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
    }

    // Filter orders by status
    const activeOrders = allOrders.filter(order => order.orderDetailsWithID.status === 0);
    const completedOrders = allOrders.filter(order => order.orderDetailsWithID.status === 2);
    const cancelledOrders = allOrders.filter(order => order.orderDetailsWithID.status === 1);


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

export function useOpenPositions(userAddress?: Address | null, fetchAllOrders?: boolean) {
  const { chainId: walletChainId, isConnected, address: connectedAddress } = useAccount();
  // Default to PulseChain mainnet when wallet not connected (for marketplace viewing)
  const chainId = walletChainId ?? PULSECHAIN_CHAIN_ID;
  const contractAddress = getContractAddress(chainId);
  
  // Determine query address:
  // - If fetchAllOrders is true, use null (marketplace mode - fetch ALL orders)
  // - Otherwise use userAddress if provided, or fall back to connectedAddress
  const queryAddress = fetchAllOrders ? null : (userAddress ?? connectedAddress);
  
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
    
    if (!contractAddress || !chainId) {
      setError(new Error('Contract not deployed on this chain'));
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Pass queryAddress for efficient user-specific queries (null for marketplace)
      const result = await fetchContractData(contractAddress as Address, chainId, queryAddress as Address | null | undefined);
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
  }, [isClient, contractAddress, chainId, queryAddress]);

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
