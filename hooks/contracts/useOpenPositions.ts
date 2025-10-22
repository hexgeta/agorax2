import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, http } from 'viem';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { getContractAddress, PULSECHAIN_CHAIN_ID, PULSECHAIN_TESTNET_CHAIN_ID } from '@/config/testing';
import { useContract } from '@/context/ContractContext';

// RPC endpoints per chain
const RPC_ENDPOINTS = {
  [PULSECHAIN_CHAIN_ID]: 'https://rpc.pulsechain.com',
  [PULSECHAIN_TESTNET_CHAIN_ID]: 'https://pulsechain-testnet-rpc.publicnode.com',
};

// Import the full ABI from the contract
const OTC_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_adminWallet",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_beanToken",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_uniswapAnchor",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_bistroStaking",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_listingFeesInUSD",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_redeemFees",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_discountInRedeemFees",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_listingFeesLimit",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_redeemFeesLimit",
        "type": "uint256"
      },
      {
        "internalType": "uint32",
        "name": "_cooldownPeriod",
        "type": "uint32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getOrderCounter",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
        "type": "uint256"
      }
    ],
    "name": "getOrderDetails",
    "outputs": [
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "orderIndex",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "orderOwner",
                "type": "address"
              }
            ],
            "internalType": "struct OTC.UserOrderDetails",
            "name": "userDetails",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "orderId",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "remainingExecutionPercentage",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "redemeedPercentage",
                "type": "uint256"
              },
              {
                "internalType": "uint32",
                "name": "lastUpdateTime",
                "type": "uint32"
              },
              {
                "internalType": "enum OTC.OrderStatus",
                "name": "status",
                "type": "uint8"
              },
              {
                "components": [
                  {
                    "internalType": "address",
                    "name": "sellToken",
                    "type": "address"
                  },
                  {
                    "internalType": "uint256",
                    "name": "sellAmount",
                    "type": "uint256"
                  },
                  {
                    "internalType": "uint256[]",
                    "name": "buyTokensIndex",
                    "type": "uint256[]"
                  },
                  {
                    "internalType": "uint256[]",
                    "name": "buyAmounts",
                    "type": "uint256[]"
                  },
                  {
                    "internalType": "uint256",
                    "name": "expirationTime",
                    "type": "uint256"
                  }
                ],
                "internalType": "struct OTC.OrderDetails",
                "name": "orderDetails",
                "type": "tuple"
              }
            ],
            "internalType": "struct OTC.OrderDetailsWithId",
            "name": "orderDetailsWithId",
            "type": "tuple"
          }
        ],
        "internalType": "struct OTC.CompleteOrderDetails",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

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

export interface OrderDetailsWithId {
  orderId: bigint;
  remainingExecutionPercentage: bigint;
  redemeedPercentage: bigint;
  lastUpdateTime: number;
  status: number; // 0: Active, 1: Cancelled, 2: Completed
  orderDetails: OrderDetails;
}

export interface CompleteOrderDetails {
  userDetails: UserOrderDetails;
  orderDetailsWithId: OrderDetailsWithId;
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
      const blockNumber = await client.getBlockNumber();
    } catch (rpcError) {
      throw rpcError;
    }
    
    // Fetch all contract data in parallel
    const [contractName, contractOwner, contractSymbol, totalSupply, orderCounter] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: OTC_ABI,
        functionName: 'name',
      }).catch(err => {
        return null;
      }),
      
      client.readContract({
        address: contractAddress,
        abi: OTC_ABI,
        functionName: 'owner',
      }).catch(err => {
        return null;
      }),
      
      client.readContract({
        address: contractAddress,
        abi: OTC_ABI,
        functionName: 'symbol',
      }).catch(err => {
        return null;
      }),
      
      client.readContract({
        address: contractAddress,
        abi: OTC_ABI,
        functionName: 'totalSupply',
      }).catch(err => {
        return null;
      }),
      
      client.readContract({
        address: contractAddress,
        abi: OTC_ABI,
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
            abi: OTC_ABI,
            functionName: 'getOrderDetails',
            args: [BigInt(orderId)],
          }).catch(err => {
            return null;
          })
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        // Filter out null results and add to allOrders
        const validOrders = batchResults.filter((order): order is CompleteOrderDetails => order !== null);
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


    return {
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
  const { chainId } = useAccount();
  const { activeContract } = useContract();
  const contractAddress = getContractAddress(chainId, activeContract);
  
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isClient, setIsClient] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isClient) return;
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
        setError(new Error('All contract calls failed. Check console for details.'));
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [isClient, contractAddress, chainId, activeContract]);

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
