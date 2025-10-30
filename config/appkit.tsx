import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, arbitrum } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { TESTING_MODE, PULSECHAIN_TESTNET_CONFIG } from './testing'

// Get projectId from https://dashboard.reown.com
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// Define PulseChain Mainnet network
const pulsechain: AppKitNetwork = {
  id: 369,
  name: 'PulseChain',
  network: 'pulsechain',
  nativeCurrency: {
    decimals: 18,
    name: 'Pulse',
    symbol: 'PLS',
  },
  rpcUrls: {
    default: { http: ['https://rpc.pulsechain.com'] },
    public: { http: ['https://rpc.pulsechain.com'] },
  },
  blockExplorers: {
    default: { name: 'PulseScan', url: 'https://scan.pulsechain.com' },
  },
  testnet: false,
}

// Testnet network with explicit configuration
const pulsechainTestnet: AppKitNetwork = {
  id: 943,
  name: 'PLS Testnet',
  network: 'pulsechain-testnet',
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
      ] 
    },
    public: { 
      http: [
        'https://rpc.v4.testnet.pulsechain.com',
        'https://pulsechain-testnet-rpc.publicnode.com',
      ] 
    },
  },
  blockExplorers: {
    default: { 
      name: 'PulseChain Testnet Explorer', 
      url: 'https://scan.v4.testnet.pulsechain.com' 
    },
  },
  testnet: true,
}

// Build networks array - include testnet first if testing mode is enabled
const networksArray: AppKitNetwork[] = TESTING_MODE 
  ? [pulsechainTestnet, pulsechain, mainnet, arbitrum]
  : [pulsechain, mainnet, arbitrum];

export const networks = networksArray as [AppKitNetwork, ...AppKitNetwork[]]

// Set up the Wagmi Adapter (Config) with explicit configuration
export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  projectId,
  networks,
  transports: {
    // Explicitly configure transports if needed
  }
})

export const config = wagmiAdapter.wagmiConfig
