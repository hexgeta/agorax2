/**
 * Testing Configuration
 * 
 * Toggle TESTING_MODE to enable/disable testnet testing
 * When enabled:
 * - Shows "PulseChain Testnet" option in chain switcher
 * - Maps chain 943 to use PulseChain testnet infrastructure
 */

// 🔧 TOGGLE THIS TO ENABLE/DISABLE TESTING MODE
export const TESTING_MODE = true;

// Chain configurations
export const PULSECHAIN_TESTNET_CHAIN_ID = 943;
export const PULSECHAIN_CHAIN_ID = 369;
export const ETHEREUM_CHAIN_ID = 1;

// Contract type for testing
export type ContractType = 'BISTRO' | 'AGORAX';

// Get contract addresses from environment variables
const BISTRO_CONTRACT = process.env.NEXT_PUBLIC_BISTRO_SMART_CONTRACT || '0x342DF6d98d06f03a20Ae6E2c456344Bb91cE33a2';
const AGORAX_CONTRACT = process.env.NEXT_PUBLIC_AGORAX_SMART_CONTRACT || 'PLACEHOLDER5555';

// Bistro Smart Contract addresses per chain
export const BISTRO_CONTRACT_ADDRESSES = {
  [PULSECHAIN_CHAIN_ID]: BISTRO_CONTRACT, // PulseChain Mainnet
  [PULSECHAIN_TESTNET_CHAIN_ID]: BISTRO_CONTRACT, // PulseChain Testnet v4
  // [ETHEREUM_CHAIN_ID]: '0x...', // Ethereum Mainnet (if needed)
} as const;

// AgoraX Smart Contract addresses per chain
export const AGORAX_CONTRACT_ADDRESSES = {
  [PULSECHAIN_CHAIN_ID]: AGORAX_CONTRACT, // PulseChain Mainnet
  [PULSECHAIN_TESTNET_CHAIN_ID]: AGORAX_CONTRACT, // PulseChain Testnet v4
  // [ETHEREUM_CHAIN_ID]: '0x...', // Ethereum Mainnet (if needed)
} as const;

// Testnet configuration
export const PULSECHAIN_TESTNET_CONFIG = {
  id: PULSECHAIN_TESTNET_CHAIN_ID,
  name: 'PulseChain Testnet v4',
  nativeCurrency: {
    name: 'Test PLS',
    symbol: 'tPLS',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://pulsechain-testnet-rpc.publicnode.com'],
    },
    public: {
      http: ['https://pulsechain-testnet-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: { 
      name: 'PulseChain Testnet Explorer', 
      url: 'https://scan.v4.testnet.pulsechain.com' 
    },
  },
  testnet: true,
};

/**
 * Gets the available chains for AppKit configuration
 * Includes testnet when testing mode is enabled
 */
export function getNetworksForAppKit() {
  // Base networks
  const networks = [];

  // Add testnet first if testing mode is enabled
  if (TESTING_MODE) {
    networks.push(PULSECHAIN_TESTNET_CONFIG);
  }

  return networks;
}

/**
 * Checks if testnet should be included in network list
 */
export function shouldIncludeTestnet(): boolean {
  return TESTING_MODE;
}

/**
 * Checks if a chain ID is the testnet
 */
export function isTestnetChain(chainId: number | undefined): boolean {
  return chainId === PULSECHAIN_TESTNET_CHAIN_ID;
}

/**
 * Gets display name for a chain ID
 */
export function getChainDisplayName(chainId: number | undefined): string {
  switch (chainId) {
    case PULSECHAIN_TESTNET_CHAIN_ID:
      return 'PulseChain Testnet v4';
    case PULSECHAIN_CHAIN_ID:
      return 'PulseChain';
    case ETHEREUM_CHAIN_ID:
      return 'Ethereum';
    default:
      return 'Unknown Network';
  }
}

/**
 * Gets the contract address for the current chain and contract type
 * Returns undefined if chain is not supported
 */
export function getContractAddress(chainId: number | undefined, contractType: ContractType = 'BISTRO'): string | undefined {
  if (!chainId) return undefined;
  
  const addresses = contractType === 'BISTRO' ? BISTRO_CONTRACT_ADDRESSES : AGORAX_CONTRACT_ADDRESSES;
  return addresses[chainId as keyof typeof addresses];
}

/**
 * Gets the Bistro Smart Contract address for the current chain
 * Returns undefined if chain is not supported
 */
export function getBistroContractAddress(chainId: number | undefined): string | undefined {
  return getContractAddress(chainId, 'BISTRO');
}

/**
 * Gets the AgoraX Smart Contract address for the current chain
 * Returns undefined if chain is not supported
 */
export function getAgoraXContractAddress(chainId: number | undefined): string | undefined {
  return getContractAddress(chainId, 'AGORAX');
}

// Alias for backwards compatibility
export const getOTCContractAddress = getBistroContractAddress;

/**
 * Checks if a chain is supported (has a contract deployed)
 */
export function isSupportedChain(chainId: number | undefined): boolean {
  if (!chainId) return false;
  return chainId in BISTRO_CONTRACT_ADDRESSES;
}

/**
 * Gets the available chains for the chain switcher UI
 * Includes testnet when testing mode is enabled
 */
export function getAvailableChains() {
  const chains = [
    {
      id: PULSECHAIN_CHAIN_ID,
      name: 'PulseChain',
      icon: '/coin-logos/PLS-white.svg',
    },
    {
      id: ETHEREUM_CHAIN_ID,
      name: 'Ethereum',
      icon: '/coin-logos/ETH-white.svg',
    },
  ];

  // Add testnet as first option when testing mode is enabled
  if (TESTING_MODE) {
    chains.unshift({
      id: PULSECHAIN_TESTNET_CHAIN_ID,
      name: 'PulseChain Testnet v4',
      icon: '/coin-logos/PLS-white.svg',
    });
  }

  return chains;
}

