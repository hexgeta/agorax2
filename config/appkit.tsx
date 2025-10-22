import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, arbitrum } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { TESTING_MODE, PULSECHAIN_TESTNET_CONFIG } from './testing'

// Get projectId from https://dashboard.reown.com
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// Define PulseChain network
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

// Testnet network (only included when TESTING_MODE is enabled)
const pulsechainTestnet: AppKitNetwork = {
  ...PULSECHAIN_TESTNET_CONFIG,
  network: 'pulsechain-testnet',
}

// Build networks array - include testnet first if testing mode is enabled
const networksArray: AppKitNetwork[] = TESTING_MODE 
  ? [pulsechainTestnet, pulsechain, mainnet, arbitrum]
  : [pulsechain, mainnet, arbitrum];

export const networks = networksArray as [AppKitNetwork, ...AppKitNetwork[]]

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  projectId,
  networks
})

export const config = wagmiAdapter.wagmiConfig
