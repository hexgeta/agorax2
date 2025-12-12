/**
 * Transaction Timeout Utilities
 * 
 * Provides timeout handling for blockchain transactions to prevent
 * hanging operations and provide better user feedback.
 */

import type { PublicClient, Hash } from 'viem';

/**
 * Configuration for transaction timeouts
 */
export const TRANSACTION_TIMEOUTS = {
  APPROVAL: 120_000, // 2 minutes for token approvals (longer for testnet)
  TRANSACTION: 180_000, // 3 minutes for standard transactions (longer for testnet)
  COMPLEX_TRANSACTION: 300_000, // 5 minutes for complex operations
  APPROVAL_VERIFICATION: 120_000, // 2 minutes for approval state verification
} as const;

/**
 * Wait for transaction receipt with timeout and error handling
 * 
 * @param publicClient - Viem public client
 * @param hash - Transaction hash
 * @param timeout - Timeout in milliseconds (default: 60 seconds)
 * @returns Transaction receipt
 * @throws Error if transaction times out or fails
 */
export async function waitForTransactionWithTimeout(
  publicClient: PublicClient,
  hash: Hash,
  timeout: number = TRANSACTION_TIMEOUTS.TRANSACTION
) {
  try {
    `);
    
    
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout,
      confirmations: 1, // Only wait for 1 confirmation on testnet
    });

    ,
      gasUsed: receipt.gasUsed.toString(),
    });

    // Check if transaction was successful
    if (receipt.status === 'reverted') {
      throw new Error('Transaction reverted on-chain. The contract rejected the transaction.');
    }

    return receipt;
  } catch (error: any) {
    
    
    // Handle timeout specifically
    if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
      throw new Error(
        `Transaction is taking longer than expected (${timeout / 1000}s). It may still be pending. Check the block explorer: https://scan.v4.testnet.pulsechain.com/tx/${hash}`
      );
    }

    // Handle user rejection
    if (error.message?.includes('rejected') || error.message?.includes('denied')) {
      throw new Error('Transaction was rejected by user.');
    }

    // Re-throw with original message
    throw error;
  }
}

/**
 * Wait for a condition to be true with timeout
 * Useful for polling blockchain state changes
 * 
 * @param checkFn - Function that returns true when condition is met
 * @param timeout - Timeout in milliseconds
 * @param interval - Check interval in milliseconds (default: 1000ms)
 * @returns void when condition is met
 * @throws Error if timeout is reached
 */
export async function waitForCondition(
  checkFn: () => boolean | Promise<boolean>,
  timeout: number,
  interval: number = 1000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await checkFn();
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Operation timed out after ${timeout / 1000} seconds.`);
}

/**
 * Execute operation with timeout
 * Wraps any async operation with a timeout
 * 
 * @param operation - Async function to execute
 * @param timeout - Timeout in milliseconds
 * @param timeoutMessage - Custom timeout error message
 * @returns Result of the operation
 * @throws Error if timeout is reached
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeout: number,
  timeoutMessage?: string
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              timeoutMessage ||
                `Operation timed out after ${timeout / 1000} seconds.`
            )
          ),
        timeout
      )
    ),
  ]);
}

/**
 * Retry an operation with exponential backoff
 * Useful for transient failures
 * 
 * @param operation - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000ms)
 * @returns Result of the operation
 * @throws Error if all retries fail
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry if user rejected
      if (
        error.message?.includes('rejected') ||
        error.message?.includes('denied') ||
        error.message?.includes('cancelled')
      ) {
        throw error;
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        throw error;
      }

      // Wait with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Format timeout duration for user display
 */
export function formatTimeout(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
}

