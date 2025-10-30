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

// Get contract address from environment variables
// AgoraX deployed at: 0x321b52b7f55ea307e9ca87891d52cc92f37905cf (PLS Testnet)
const AGORAX_CONTRACT = process.env.NEXT_PUBLIC_AGORAX_SMART_CONTRACT || '';

// Debug: Log contract address on load
if (typeof window !== 'undefined') {
  console.log('🔍 AgoraX Contract Address:', AGORAX_CONTRACT);
  console.log('🔍 Environment Variable:', process.env.NEXT_PUBLIC_AGORAX_SMART_CONTRACT);
}

// AgoraX Smart Contract addresses per chain
export const CONTRACT_ADDRESSES = {
  [PULSECHAIN_CHAIN_ID]: AGORAX_CONTRACT, // PulseChain Mainnet
  [PULSECHAIN_TESTNET_CHAIN_ID]: AGORAX_CONTRACT, // PulseChain Testnet v4
} as const;

// Testnet configuration with multiple RPC fallbacks
export const PULSECHAIN_TESTNET_CONFIG = {
  id: PULSECHAIN_TESTNET_CHAIN_ID,
  name: 'PLS Testnet',
  nativeCurrency: {
    name: 'Test PLS',
    symbol: 'tPLS',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        'https://rpc.v4.testnet.pulsechain.com',
        'https://pulsechain-testnet-rpc.publicnode.com',
        'https://rpc-testnet-pulsechain.g4mm4.io',
      ],
    },
    public: {
      http: [
        'https://rpc.v4.testnet.pulsechain.com',
        'https://pulsechain-testnet-rpc.publicnode.com',
        'https://rpc-testnet-pulsechain.g4mm4.io',
      ],
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
      return 'PLS Testnet';
    case PULSECHAIN_CHAIN_ID:
      return 'PulseChain';
    case ETHEREUM_CHAIN_ID:
      return 'Ethereum';
    default:
      return 'Unknown Network';
  }
}

/**
 * Gets the AgoraX contract address for the current chain
 * Returns undefined if chain is not supported
 */
export function getContractAddress(chainId: number | undefined): string | undefined {
  if (!chainId) return undefined;
  const address = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  
  // Return undefined if address is empty string
  if (!address || address === '') {
    console.error('❌ No contract address configured for chain', chainId);
    console.error('❌ Please set NEXT_PUBLIC_AGORAX_SMART_CONTRACT in .env.local');
    return undefined;
  }
  
  return address;
}

/**
 * Checks if a chain is supported (has a contract deployed)
 */
export function isSupportedChain(chainId: number | undefined): boolean {
  if (!chainId) return false;
  return chainId in CONTRACT_ADDRESSES;
}

/**
 * Gets the available chains for the chain switcher UI
 * Includes testnet when testing mode is enabled
 */
export function getAvailableChains() {
  const chains = [
    {
      id: 369,           // PulseChain
      name: 'PulseChain',
      icon: '/coin-logos/PLS-white.svg',
    },
  ];

  // Add testnet as first option when TESTING_MODE is true
  if (TESTING_MODE) {
    chains.unshift({
      id: 943,           // PulseChain Testnet v4
      name: 'PLS Testnet',
      icon: '/coin-logos/PLS-white.svg',
    });
  }

  return chains;
}

