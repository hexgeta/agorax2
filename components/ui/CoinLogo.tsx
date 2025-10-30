import { cn } from '@/lib/utils'

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
  
  // Special case for ETH with no background
  const logoPath = logoSymbol === 'ETH' && variant === 'no-bg'
    ? '/coin-logos/eth-black-no-bg.svg'
    : `/coin-logos/${logoSymbol}.svg`
  
  return (
    <img
      src={logoPath}
      alt={`${symbol} logo`}
      className={cn(
        LOGO_SIZES[size],
        'object-contain',
        logoSymbol === 'HEX' ? '' : 'rounded-full',
        inverted ? 'brightness-0 invert' : '',
        className
      )}
      loading={priority ? 'eager' : 'lazy'}
      onError={(e) => {
        // Fallback to default logo if the image fails to load
        e.currentTarget.src = '/coin-logos/default.svg'
      }}
    />
  )
} 