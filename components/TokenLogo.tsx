'use client';

import logoManifest from '@/constants/logo-manifest.json';
import { INLINE_LOGOS } from '@/constants/inline-logos';

interface TokenLogoProps {
  ticker: string;
  className?: string;
  style?: React.CSSProperties;
}

export function TokenLogo({ ticker, className = '', style }: TokenLogoProps) {
  // Remove any 'p' or 'e' prefix from the ticker (e.g., pHEX -> HEX, eUSDC -> USDC)
  const baseTicker = ticker.replace(/^[pe]/, '');

  // Look up exact format from manifest (no 404s!)
  const getLogoSrc = () => {
    // Use inline logos for priority tokens (instant load, no network request)
    if (INLINE_LOGOS[baseTicker]) {
      return INLINE_LOGOS[baseTicker];
    }

    // Try the base ticker first (handles pHEX, eHEX, etc.)
    const format = (logoManifest as Record<string, string>)[baseTicker];
    if (format) {
      return `/coin-logos/${baseTicker}.${format}`;
    }
    // Fallback to original ticker if base not found
    const originalFormat = (logoManifest as Record<string, string>)[ticker];
    if (originalFormat) {
      return `/coin-logos/${ticker}.${originalFormat}`;
    }
    return '/coin-logos/default.svg';
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Fallback to default if manifest lookup failed
    e.currentTarget.src = '/coin-logos/default.svg';
  };

  return (
    <img
      src={getLogoSrc()}
      alt={`${ticker} logo`}
      className={`object-contain ${className}`}
      style={style}
      onError={handleError}
    />
  );
}

