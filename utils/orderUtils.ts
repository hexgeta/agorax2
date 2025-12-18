/**
 * Shared utility functions for order processing
 */

/**
 * Get the remaining fill percentage for an order
 * Returns remainingSellAmount / sellAmount as a percentage in basis points (1e18)
 */
export const getRemainingPercentage = (orderDetailsWithID: any): bigint => {
  // Use remainingFillPercentage if available (from old contract)
  // Otherwise use remainingExecutionPercentage (from newer versions)
  // Fall back to calculating from remainingSellAmount
  if (orderDetailsWithID.remainingFillPercentage) {
    return orderDetailsWithID.remainingFillPercentage;
  }
  
  if (orderDetailsWithID.remainingExecutionPercentage) {
    return orderDetailsWithID.remainingExecutionPercentage;
  }
  
  // Calculate manually: (remainingSellAmount * 1e18) / originalSellAmount
  const remainingSellAmount = BigInt(orderDetailsWithID.remainingSellAmount || 0);
  const originalSellAmount = BigInt(orderDetailsWithID.orderDetails?.sellAmount || 1);
  
  if (originalSellAmount === 0n) return 0n;
  
  return (remainingSellAmount * BigInt(1e18)) / originalSellAmount;
};
