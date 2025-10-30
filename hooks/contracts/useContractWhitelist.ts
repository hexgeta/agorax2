import { useAccount, useContractWrite } from 'wagmi';
import { Address } from 'viem';
import { getContractAddress } from '@/config/testing';
import { CONTRACT_ABI } from '@/config/abis';

// Whitelist of allowed WRITE functions (non-admin only)
// AgoraX write functions
const WRITE_FUNCTIONS = [
  'placeOrder',            // Create a new trading order (sell tokens for buy tokens)
  'cancelOrder',           // Cancel your order after you make it
  'redeemOrder',           // Redeem tokens from a single executed order
  'fillOrder',             // Fill/fulfill a single trading order
  'cancelAllExpiredOrders' // Cancel all expired orders at once
] as const;

type WhitelistedWriteFunction = typeof WRITE_FUNCTIONS[number];

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

export type ReadFunction = typeof READ_FUNCTIONS[number];

/**
 * Hook that provides whitelisted contract write functions
 * Only allows function calls when wallet is connected
 */
export function useContractWhitelist() {
  const { isConnected, address, chainId } = useAccount();
  const { writeContractAsync } = useContractWrite();

  // Get the contract address for the current chain
  const contractAddress = getContractAddress(chainId);

  /**
   * Check if a function is whitelisted for write operations
   */
  const isWriteFunctionWhitelisted = (functionName: string): functionName is WhitelistedWriteFunction => {
    return (WRITE_FUNCTIONS as readonly string[]).includes(functionName);
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
        abi: CONTRACT_ABI,
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
    
    redeemOrder: (orderId: bigint) => 
      executeWriteFunction('redeemOrder', [orderId]),
    
    fillOrder: (orderId: bigint, buyTokenIndex: bigint, buyAmount: bigint, value?: bigint) => 
      executeWriteFunction('fillOrder', [orderId, buyTokenIndex, buyAmount], value),
    
    cancelAllExpiredOrders: () => 
      executeWriteFunction('cancelAllExpiredOrders', []),
    
    // Alias for backwards compatibility (fillOrder is the AgoraX function)
    fillOrExecuteOrder: (orderId: bigint, buyTokenIndex: bigint, buyAmount: bigint, value?: bigint) => 
      executeWriteFunction('fillOrder', [orderId, buyTokenIndex, buyAmount], value),
    executeOrder: (orderId: bigint, buyTokenIndex: bigint, buyAmount: bigint, value?: bigint) => 
      executeWriteFunction('fillOrder', [orderId, buyTokenIndex, buyAmount], value),
  };
}
