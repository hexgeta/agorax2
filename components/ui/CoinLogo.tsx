'use client'

import { cn } from '@/lib/utils'
import logoManifest from '@/constants/logo-manifest.json'

const LOGO_SIZES = {
  sm: 'w-4 h-4',   // 16px
  md: 'w-6 h-6',   // 24px
  lg: 'w-8 h-8',   // 32px
  xl: 'w-10 h-10', // 40px
} as const

interface CoinLogoProps {
  symbol: string
  size?: keyof typeof LOGO_SIZES
  className?: string
  priority?: boolean
  inverted?: boolean
  variant?: 'default' | 'no-bg'
}

export function CoinLogo({ 
  symbol, 
  size = 'md', 
  className,
  priority = false,
  inverted = false,
  variant = 'default'
}: CoinLogoProps) {
  // Remove any 'p' or 'e' prefix from the symbol
  const baseSymbol = symbol.replace(/^[pe]/, '')
  
  // Use the base symbol as the logo symbol
  const logoSymbol = baseSymbol
  
  // Get logo path - use manifest to get exact file format (no 404s!)
  const getLogoPath = () => {
    // Special case for ETH with no background
    if (logoSymbol === 'ETH' && variant === 'no-bg') {
      const format = (logoManifest as Record<string, string>)['eth-black-no-bg'] || 'svg'
      return `/coin-logos/eth-black-no-bg.${format}`
    }
    
    // Look up the actual format from manifest
    const format = (logoManifest as Record<string, string>)[logoSymbol]
    if (format) {
      return `/coin-logos/${logoSymbol}.${format}`
    }
    
    // Fallback to default if not in manifest
    return '/coin-logos/default.svg'
  }
  
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Only fallback to default if the manifest lookup failed
    e.currentTarget.src = '/coin-logos/default.svg'
  }
  
  return (
    <img
      src={getLogoPath()}
      alt={`${symbol} logo`}
      className={cn(
        LOGO_SIZES[size],
        'object-contain',
        logoSymbol === 'HEX' ? '' : 'rounded-full',
        inverted ? 'brightness-0 invert' : '',
        className
      )}
      loading={priority ? 'eager' : 'lazy'}
      onError={handleError}
    />
  )
} 