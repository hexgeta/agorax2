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
  APPROVAL: 120_000, // 2 minutes for token approvals
  TRANSACTION: 300_000, // 5 minutes for standard transactions (increased for PulseChain)
  COMPLEX_TRANSACTION: 420_000, // 7 minutes for complex operations
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
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add delay before each attempt - longer delay for retries
      const delay = attempt === 0 ? 1000 : 3000;
      await new Promise(resolve => setTimeout(resolve, delay));

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: attempt === 0 ? timeout : 60000, // Shorter timeout for retries
        confirmations: 1,
        pollingInterval: 2000,
      });

      // Check if transaction was successful
      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain. The contract rejected the transaction.');
      }

      return receipt;
    } catch (error: any) {
      // Handle user rejection - don't retry
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        throw new Error('Transaction was rejected by user.');
      }

      // Handle revert - don't retry
      if (error.message?.includes('reverted')) {
        throw error;
      }

      // Check if this is a retriable error (not found, timeout, etc.)
      const isRetriable =
        error.message?.includes('timeout') ||
        error.message?.includes('timed out') ||
        error.message?.includes('could not be found') ||
        error.message?.includes('may not be processed on a block yet');

      if (isRetriable && attempt < maxRetries - 1) {
        // Retry after delay
        lastError = error;
        continue;
      }

      // Final attempt failed or non-retriable error
      if (isRetriable) {
        const timeoutError = new Error(
          `Transaction submitted but confirmation is taking longer than expected. Check Otterscan to verify: https://otter.pulsechain.com/tx/${hash}`
        );
        (timeoutError as any).isTimeout = true;
        throw timeoutError;
      }

      // Re-throw non-retriable errors
      throw error;
    }
  }

  // Should not reach here, but handle just in case
  throw lastError || new Error('Transaction confirmation failed after retries');
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

