import { useAccount, useContractWrite } from 'wagmi';
import { Address } from 'viem';
import { getContractAddress } from '@/config/testing';
import { useContract } from '@/context/ContractContext';
import { getContractABI } from '@/config/abis';

// Whitelist of allowed WRITE functions (non-admin only)
// Bistro functions
const BISTRO_WRITE_FUNCTIONS = [
  'placeOrder',            // Create a new trading order (sell tokens for buy tokens)
  'cancelOrder',           // cancel your order after you make it
  'redeemOrder',           // Redeem tokens from a single executed order
  'redeemMultipleOrders',  // Redeem tokens from multiple executed orders
  'executeMultipleOrder',  // Execute multiple orders in a single transaction
  'executeOrder',          // Execute/fulfill a single trading order (Bistro)
  'updateOrderExpirationTime', // Update the expiration time of user's own order
  'updateOrderInfo',       // Update order details (sell amount, buy tokens, amounts)
  'updateOrderPrice'       // Update the price/amounts for user's own order
] as const;

// AgoraX functions
const AGORAX_WRITE_FUNCTIONS = [
  'placeOrder',            // Create a new trading order (sell tokens for buy tokens)
  'cancelOrder',           // cancel your order after you make it
  'redeemOrder',           // Redeem tokens from a single executed order
  'fillOrder',             // Fill/fulfill a single trading order (AgoraX)
  'cancelAllExpiredOrders' // Cancel all expired orders at once (AgoraX)
] as const;

// Combined type for all write functions
type BistroWriteFunction = typeof BISTRO_WRITE_FUNCTIONS[number];
type AgoraXWriteFunction = typeof AGORAX_WRITE_FUNCTIONS[number];
type WhitelistedWriteFunction = BistroWriteFunction | AgoraXWriteFunction;

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
  const { activeContract } = useContract();

  // Get the contract address and ABI for the current chain and active contract
  const contractAddress = getContractAddress(chainId, activeContract);
  const contractABI = getContractABI(activeContract);
  
  // Get the correct function list based on active contract
  const allowedWriteFunctions = activeContract === 'BISTRO' 
    ? BISTRO_WRITE_FUNCTIONS 
    : AGORAX_WRITE_FUNCTIONS;

  /**
   * Check if a function is whitelisted for write operations
   */
  const isWriteFunctionWhitelisted = (functionName: string): functionName is WhitelistedWriteFunction => {
    return (allowedWriteFunctions as readonly string[]).includes(functionName);
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
        abi: contractABI,
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

  // Unified fill/execute function that works for both contracts
  const fillOrExecuteOrder = (orderId: bigint, buyTokenIndex: bigint, buyAmount: bigint, value?: bigint) => {
    const functionName = activeContract === 'AGORAX' ? 'fillOrder' : 'executeOrder';
    return executeWriteFunction(functionName as WhitelistedWriteFunction, [orderId, buyTokenIndex, buyAmount], value);
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
    activeContract,
    
    // Individual function wrappers for convenience (common to both)
    placeOrder: (orderDetails: any, value?: bigint) => 
      executeWriteFunction('placeOrder', [orderDetails], value),
    
    cancelOrder: (orderId: bigint) => 
      executeWriteFunction('cancelOrder', [orderId]),
    
    redeemOrder: (orderId: bigint) => 
      executeWriteFunction('redeemOrder', [orderId]),
    
    // Unified function that works for both contracts
    fillOrExecuteOrder,
    
    // Bistro-specific functions
    executeOrder: activeContract === 'BISTRO' 
      ? (orderId: bigint, buyTokenIndex: bigint, buyAmount: bigint, value?: bigint) => 
          executeWriteFunction('executeOrder', [orderId, buyTokenIndex, buyAmount], value)
      : undefined,
    
    executeMultipleOrder: activeContract === 'BISTRO'
      ? (orderIds: bigint[], buyTokenIndexes: bigint[], buyAmounts: bigint[], value?: bigint) => 
          executeWriteFunction('executeMultipleOrder', [orderIds, buyTokenIndexes, buyAmounts], value)
      : undefined,
    
    redeemMultipleOrders: activeContract === 'BISTRO'
      ? (orderIds: bigint[]) => 
          executeWriteFunction('redeemMultipleOrders', [orderIds])
      : undefined,
    
    updateOrderInfo: activeContract === 'BISTRO'
      ? (orderId: bigint, newSellAmount: bigint, newBuyTokensIndex: bigint[], newBuyAmounts: bigint[], value?: bigint) => 
          executeWriteFunction('updateOrderInfo', [orderId, newSellAmount, newBuyTokensIndex, newBuyAmounts], value)
      : undefined,
    
    updateOrderPrice: activeContract === 'BISTRO'
      ? (orderId: bigint, indexes: bigint[], newBuyAmounts: bigint[]) => 
          executeWriteFunction('updateOrderPrice', [orderId, indexes, newBuyAmounts])
      : undefined,
    
    updateOrderExpirationTime: activeContract === 'BISTRO'
      ? (orderId: bigint, expirationTime: bigint) => 
          executeWriteFunction('updateOrderExpirationTime', [orderId, expirationTime])
      : undefined,
    
    // AgoraX-specific functions
    fillOrder: activeContract === 'AGORAX'
      ? (orderId: bigint, buyTokenIndex: bigint, buyAmount: bigint, value?: bigint) => 
          executeWriteFunction('fillOrder', [orderId, buyTokenIndex, buyAmount], value)
      : undefined,
    
    cancelAllExpiredOrders: activeContract === 'AGORAX'
      ? () => executeWriteFunction('cancelAllExpiredOrders', [])
      : undefined,
  };
}
