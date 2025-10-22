import { useAccount, useContractWrite } from 'wagmi';
import { Address } from 'viem';
import { getContractAddress } from '@/config/testing';
import { useContract } from '@/context/ContractContext';

// Whitelist of allowed WRITE functions (non-admin only)
const WHITELISTED_WRITE_FUNCTIONS = [
  'placeOrder',            // Create a new trading order (sell tokens for buy tokens)
  'cancelOrder',           // cancel your order after you make it

  'redeemOrder',           // Redeem tokens from a single executed order
  
  'redeemMultipleOrders',  // Redeem tokens from multiple executed orders

  'executeMultipleOrder',  // Execute multiple orders in a single transaction
  'executeOrder',          // Execute/fulfill a single trading order

  
  'updateOrderExpirationTime', // Update the expiration time of user's own order
  'updateOrderInfo',       // Update order details (sell amount, buy tokens, amounts)
  'updateOrderPrice'       // Update the price/amounts for user's own order
] as const;

// List of READ functions (view functions - no wallet connection required)
const READ_FUNCTIONS = [
  'getUserOrdersLength',        // Get the number of orders for a specific user
  'viewUserAllOrders',          // View all orders for a specific user (paginated)
  'viewUserCompletedOrders',    // View completed orders for a specific user (paginated)
  'viewUserActiveOrders',       // View active orders for a specific user (paginated)
  'viewUserCancelledOrders',    // View cancelled orders for a specific user (paginated)
  'getOrderDetails',            // Get complete details of a specific order by ID
  'getAvailableRedeemableTokens', // Get tokens available for redemption from an order
  'getOrderCounter',            // Get the total number of orders created
  'getAdminWalletAddress',      // Get the admin wallet address
  'getUniswapAnchorViewAddress', // Get the Uniswap anchor view contract address
  'getBistroStakingAddress',    // Get the Bistro staking contract address
  'getBeanTokenAddress',        // Get the Bean token contract address
  'getRedeemFees',              // Get the current redeem fees percentage
  'getDiscountInRedeemFees',    // Get the discount percentage for redeem fees
  'getListingFeesInUSD',        // Get the listing fees in USD
  'getCooldownPeriod'           // Get the cooldown period for order updates
] as const;

export type WhitelistedWriteFunction = typeof WHITELISTED_WRITE_FUNCTIONS[number];
export type ReadFunction = typeof READ_FUNCTIONS[number];

// Full contract ABI with all write functions
const OTC_ABI = [
  // Place Order
  {
    "inputs": [
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
        "name": "_orderDetails",
        "type": "tuple"
      }
    ],
    "name": "placeOrder",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // Cancel Order
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
        "type": "uint256"
      }
    ],
    "name": "cancelOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Execute Order
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_buyTokenIndexInOrder",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_buyAmount",
        "type": "uint256"
      }
    ],
    "name": "executeOrder",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // Execute Multiple Orders
  {
    "inputs": [
      {
        "internalType": "uint256[]",
        "name": "_orderIds",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "_buyTokenIndexInOrders",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "_buyAmounts",
        "type": "uint256[]"
      }
    ],
    "name": "executeMultipleOrder",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // Redeem Order
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
        "type": "uint256"
      }
    ],
    "name": "redeemOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Redeem Multiple Orders
  {
    "inputs": [
      {
        "internalType": "uint256[]",
        "name": "_orderIds",
        "type": "uint256[]"
      }
    ],
    "name": "redeemMultipleOrders",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // ERC20 Functions
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
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "transfer",
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
        "name": "from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
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
  // Ownership Functions
  {
    "inputs": [],
    "name": "acceptOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Admin Functions
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_adminWallet",
        "type": "address"
      }
    ],
    "name": "updateAdminWallet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_beanToken",
        "type": "address"
      }
    ],
    "name": "updateBeanToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_bistroStaking",
        "type": "address"
      }
    ],
    "name": "updateBistroStaking",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "_cooldownPeriod",
        "type": "uint32"
      }
    ],
    "name": "updateCoolDownPeriod",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_discountInRedeemFees",
        "type": "uint256"
      }
    ],
    "name": "updateDiscountInRedeemFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_listingFees",
        "type": "uint256"
      }
    ],
    "name": "updateListingFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderExpirationTime",
        "type": "uint256"
      }
    ],
    "name": "updateOrderExpirationTime",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
        "type": "uint256"
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
        "name": "_orderDetails",
        "type": "tuple"
      }
    ],
    "name": "updateOrderInfo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_orderId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_newPrice",
        "type": "uint256"
      }
    ],
    "name": "updateOrderPrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_redeemFees",
        "type": "uint256"
      }
    ],
    "name": "updateRedeemFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_uniswapAnchor",
        "type": "address"
      }
    ],
    "name": "updateUniswapAnchor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_tokenAddress",
        "type": "address"
      }
    ],
    "name": "addTokenAddress",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_tokenAddress",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "_status",
        "type": "bool"
      }
    ],
    "name": "setTokenStatus",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

/**
 * Hook that provides whitelisted contract write functions
 * Only allows function calls when wallet is connected
 */
export function useContractWhitelist() {
  const { isConnected, address, chainId } = useAccount();
  const { writeContractAsync } = useContractWrite();
  const { activeContract } = useContract();

  // Get the contract address for the current chain and active contract
  const contractAddress = getContractAddress(chainId, activeContract);

  /**
   * Check if a function is whitelisted for write operations
   */
  const isWriteFunctionWhitelisted = (functionName: string): functionName is WhitelistedWriteFunction => {
    return WHITELISTED_WRITE_FUNCTIONS.includes(functionName as WhitelistedWriteFunction);
  };

  /**
   * Check if a function is a read function
   */
  const isReadFunction = (functionName: string): functionName is ReadFunction => {
    return READ_FUNCTIONS.includes(functionName as ReadFunction);
  };

  /**
   * Execute a whitelisted write function
   */
  const executeWriteFunction = async (
    functionName: WhitelistedWriteFunction,
    args: any[] = [],
    value?: bigint
  ) => {
    // Check if wallet is connected
    if (!isConnected || !address) {
      throw new Error('Wallet not connected. Please connect your wallet to execute contract functions.');
    }

    // Check if contract address exists for current chain
    if (!contractAddress) {
      throw new Error('Contract not deployed on this chain. Please switch to a supported network.');
    }

    // Check if function is whitelisted for write operations
    if (!isWriteFunctionWhitelisted(functionName)) {
      throw new Error(`Function "${functionName}" is not whitelisted for write operations.`);
    }

    // Execute the contract function
    try {
      const result = await writeContractAsync({
        address: contractAddress as Address,
        abi: OTC_ABI,
        functionName,
        args: args as any,
        value,
        // Add transaction metadata for better wallet display
        gas: 2000000n, // Set a reasonable gas limit
      });

      return result;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Get all whitelisted write functions
   */
  const getWhitelistedWriteFunctions = () => {
    return [...WHITELISTED_WRITE_FUNCTIONS];
  };

  /**
   * Get all read functions
   */
  const getReadFunctions = () => {
    return [...READ_FUNCTIONS];
  };

  /**
   * Check if wallet is connected
   */
  const isWalletConnected = () => {
    return isConnected && !!address;
  };

  return {
    // Main execution function
    executeWriteFunction,
    
    // Utility functions
    isWriteFunctionWhitelisted,
    isReadFunction,
    getWhitelistedWriteFunctions,
    getReadFunctions,
    isWalletConnected,
    
    // Connection status
    isConnected,
    address,
    chainId,
    contractAddress,
    
    // Individual function wrappers for convenience
    placeOrder: (orderDetails: any, value?: bigint) => 
      executeWriteFunction('placeOrder', [orderDetails], value),
    
    cancelOrder: (orderId: bigint) => 
      executeWriteFunction('cancelOrder', [orderId]),
    
    executeOrder: (orderId: bigint, buyTokenIndex: bigint, buyAmount: bigint, value?: bigint) => 
      executeWriteFunction('executeOrder', [orderId, buyTokenIndex, buyAmount], value),
    
    executeMultipleOrder: (orderIds: bigint[], buyTokenIndexes: bigint[], buyAmounts: bigint[], value?: bigint) => 
      executeWriteFunction('executeMultipleOrder', [orderIds, buyTokenIndexes, buyAmounts], value),
    
    redeemOrder: (orderId: bigint) => 
      executeWriteFunction('redeemOrder', [orderId]),
    
    redeemMultipleOrders: (orderIds: bigint[]) => 
      executeWriteFunction('redeemMultipleOrders', [orderIds]),
    
    updateOrderInfo: (orderId: bigint, newSellAmount: bigint, newBuyTokensIndex: bigint[], newBuyAmounts: bigint[], value?: bigint) => 
      executeWriteFunction('updateOrderInfo', [orderId, newSellAmount, newBuyTokensIndex, newBuyAmounts], value),
    
    updateOrderPrice: (orderId: bigint, indexes: bigint[], newBuyAmounts: bigint[]) => 
      executeWriteFunction('updateOrderPrice', [orderId, indexes, newBuyAmounts]),
    
    updateOrderExpirationTime: (orderId: bigint, expirationTime: bigint) => 
      executeWriteFunction('updateOrderExpirationTime', [orderId, expirationTime]),
  };
}
