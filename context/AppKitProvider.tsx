'use client'

import { wagmiAdapter, projectId, networks } from '@/config/appkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import React, { type ReactNode } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'
import { useAppKitScrollLock } from '@/hooks/useAppKitScrollLock'

// Set up queryClient
const queryClient = new QueryClient()

// Set up metadata
const metadata = {
  name: 'OTC Max - PulseChain Trading',
  description: 'Over-the-counter trading platform for PulseChain tokens',
  url: 'https://otc.lookintomaxi.com',
  icons: ['https://otc.lookintomaxi.com/favicon.png']
}

// Create the modal
export const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  metadata,
  themeMode: 'dark',
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
    email: true, // Enable email login
    socials: ['google', 'twitter', 'discord'], // Social login options
    emailShowWallets: true, // Show wallet options in email flow
  },
  // Remove branding
  enableNetworkView: false,
  enableAccountView: false,
  themeVariables: {
    // Colors - Black and White Theme
    '--w3m-accent': '#ffffff', // White accent for buttons and highlights
    '--w3m-background-color': 'rgba(0, 0, 0, 0.8)', // Black backdrop with transparency
    '--w3m-color-bg-1': '#000000', // Pure black modal background
    '--w3m-color-bg-2': '#000', // Dark gray secondary background
    '--w3m-color-bg-3': '#000', // Lighter gray for cards/inputs
    '--w3m-color-fg-1': '#ffffff', // Pure white primary text
    '--w3m-color-fg-2': '#e5e5e5', // Light gray secondary text
    '--w3m-color-fg-3': '#cccccc', // Medium gray tertiary text
    
    // Borders and radius
    '--w3m-border-radius-master': '8px', // Border radius
    '--w3m-border-radius-secondary': '8px', // Secondary radius
    
    // Effects
    '--w3m-backdrop-filter': 'blur(4px)', // Blur effect
    '--w3m-z-index': '9999', // Higher than navbar and footer
    
    // Borders and overlays
    '--w3m-color-overlay': 'rgba(255, 255, 255, 0.1)', // White overlay for hover states
    '--w3m-color-error': '#ff4444', // Red for errors
    '--w3m-color-success': '#44ff44', // Green for success
    
    // Fonts
    '--w3m-font-family': 'Persephone, ui-sans-serif, system-ui, sans-serif',
    '--w3m-font-size-master': '10px',
    '--w3m-line-height-master': '1.5', // Line height for better readability
  }
  // Show all 470+ wallets - removed includeWalletIds to display complete selection
})

function AppKitProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)
  
  // Temporarily disable scroll lock to debug
  // useAppKitScrollLock()

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

export default AppKitProvider
