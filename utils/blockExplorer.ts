/**
 * Get the block explorer URL for a transaction hash based on chain ID
 * @param chainId - The chain ID (369 for mainnet, 943 for testnet)
 * @param txHash - The transaction hash
 * @returns Full URL to view the transaction on the appropriate explorer
 */
export function getBlockExplorerTxUrl(chainId: number | undefined, txHash: string): string {
  // Testnet (943) - Use PulseChain Testnet Explorer (no internal page)
  if (chainId === 943) {
    return `https://scan.v4.testnet.pulsechain.com/tx/${txHash}`;
  }

  // Mainnet & default - Use internal tx page
  return `/tx/${txHash}`;
}

/**
 * Get the block explorer base URL based on chain ID
 * @param chainId - The chain ID (369 for mainnet, 943 for testnet)
 * @returns Base URL for the block explorer
 */
export function getBlockExplorerUrl(chainId: number | undefined): string {
  // Testnet (943) - Use PulseChain Testnet Explorer
  if (chainId === 943) {
    return 'https://scan.v4.testnet.pulsechain.com';
  }

  // Mainnet & default - Use internal paths
  return '';
}

/**
 * Get the block explorer name based on chain ID
 * @param chainId - The chain ID (369 for mainnet, 943 for testnet)
 * @returns Name of the block explorer
 */
export function getBlockExplorerName(chainId: number | undefined): string {
  // Mainnet (369) - Use Otterscan
  if (chainId === 369) {
    return 'Otterscan';
  }
  
  // Testnet (943) - Use PulseChain Testnet Explorer  
  if (chainId === 943) {
    return 'PulseChain Testnet Explorer';
  }
  
  // Default
  return 'Otterscan';
}
