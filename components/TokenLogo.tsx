'use client';

import logoManifest from '@/constants/logo-manifest.json';

interface TokenLogoProps {
  ticker: string;
  className?: string;
  style?: React.CSSProperties;
}

export function TokenLogo({ ticker, className = '', style }: TokenLogoProps) {
  // Look up exact format from manifest (no 404s!)
  const getLogoSrc = () => {
    const format = (logoManifest as Record<string, string>)[ticker];
    if (format) {
      return `/coin-logos/${ticker}.${format}`;
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
      className={className}
      style={style}
      onError={handleError}
    />
  );
}

