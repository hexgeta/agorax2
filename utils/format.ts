export function formatNumber(value: number, options: {
  prefix?: string,
  suffix?: string,
  decimals?: number,
  compact?: boolean,
  percentage?: boolean,
  alreadyPercentage?: boolean
} = {}) {
  const { 
    prefix = '', 
    suffix = '',
    decimals = 2,
    compact = false,
    percentage = false,
    alreadyPercentage = false
  } = options

  let formattedValue = value
  
  if (percentage) {
    // If the value is already a percentage (like from DexScreener), don't multiply by 100
    formattedValue = alreadyPercentage ? value : value * 100
    return prefix + new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(formattedValue) + '%'
  }

  if (compact) {
    if (value >= 1e15) {
      const q = value / 1e15
      return prefix + (q < 10 ? q.toFixed(2) : q < 100 ? q.toFixed(1) : Math.round(q)) + 'Q' + suffix
    }
    if (value >= 1e12) {
      const t = value / 1e12
      return prefix + (t < 10 ? t.toFixed(2) : t < 100 ? t.toFixed(1) : Math.round(t)) + 'T' + suffix
    }
    if (value >= 1e9) {
      const b = value / 1e9
      return prefix + (b < 10 ? b.toFixed(2) : b < 100 ? b.toFixed(1) : Math.round(b)) + 'B' + suffix
    }
    if (value >= 1e6) {
      const m = value / 1e6
      return prefix + (m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : Math.round(m)) + 'M' + suffix
    }
    if (value >= 1e3) {
      const k = value / 1e3
      return prefix + (k < 10 ? k.toFixed(2) : k < 100 ? k.toFixed(1) : Math.round(k)) + 'K' + suffix
    }
  }

  // For very small numbers (like crypto prices)
  if (value < 0.001) {
    return prefix + value.toFixed(7) + suffix
  }

  return prefix + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value) + suffix
}

export function formatPrice(value: number) {
  return formatNumber(value, { prefix: '$', decimals: 4 })
}

export function formatHexRatio(value: number) {
  return formatNumber(value, { decimals: 2 })
}

export function formatBacking(value: number) {
  return formatNumber(value, { decimals: 2, compact: true })
}

export function formatPercent(value: number, opts: { alreadyPercentage?: boolean } = {}) {
  // For values >= 100%, show no decimals
  // For values >= 10%, show 1 decimal
  // For values < 10%, show 2 decimals
  const decimals = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  const sign = value > 0 ? '+' : '';
  return sign + formatNumber(value, {
    decimals,
    percentage: true,
    alreadyPercentage: opts.alreadyPercentage ?? true
  });
}

/**
 * Format large numbers with compact notation (K, M, B, T, Q)
 * For numbers over 100,000, use K/M/B notation
 * @param value - The number to format
 * @returns Formatted string like "1.5M" or "250K"
 */
export function formatLargeNumber(value: number): string {
  if (value === 0) return '0';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  // Quadrillions (1e15)
  if (absValue >= 1e15) {
    const q = absValue / 1e15;
    return sign + (q < 10 ? q.toFixed(1) : Math.round(q).toLocaleString()) + 'Q';
  }

  // Trillions (1e12)
  if (absValue >= 1e12) {
    const t = absValue / 1e12;
    return sign + (t < 10 ? t.toFixed(1) : Math.round(t).toLocaleString()) + 'T';
  }

  // Billions (1e9)
  if (absValue >= 1e9) {
    const b = absValue / 1e9;
    return sign + (b < 10 ? b.toFixed(1) : Math.round(b).toLocaleString()) + 'B';
  }

  // Millions (1e6)
  if (absValue >= 1e6) {
    const m = absValue / 1e6;
    return sign + (m < 10 ? m.toFixed(1) : Math.round(m).toLocaleString()) + 'M';
  }

  // Thousands (100K+)
  if (absValue >= 100000) {
    const k = absValue / 1000;
    return sign + (k < 10 ? k.toFixed(1) : Math.round(k).toLocaleString()) + 'K';
  }

  // For values >= 10000, no decimals
  if (absValue >= 10000) {
    return sign + absValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  // For values >= 1000, 1 decimal
  if (absValue >= 1000) {
    return sign + absValue.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }

  // For values >= 100, 2 decimals
  if (absValue >= 100) {
    return sign + absValue.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  // For values >= 10, 3 decimals
  if (absValue >= 10) {
    return sign + absValue.toLocaleString('en-US', { maximumFractionDigits: 3 });
  }

  // For values >= 1, 4 decimals
  if (absValue >= 1) {
    return sign + absValue.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }

  // For values >= 0.00001, show normally with appropriate decimals
  if (absValue >= 0.00001) {
    const sigFigs = 4;
    const magnitude = Math.floor(Math.log10(absValue));
    const decimals = Math.max(0, sigFigs - 1 - magnitude);
    return sign + absValue.toFixed(decimals);
  }

  // For very small values (< 0.00001), use subscript notation: 0.0₅1234
  // Count leading zeros after decimal point
  const str = absValue.toFixed(20); // Get enough precision
  const match = str.match(/^0\.(0+)([1-9]\d*)/);
  if (match) {
    const leadingZeros = match[1].length;
    const significantDigits = match[2].slice(0, 4); // Keep 4 significant digits
    // Unicode subscript digits: ₀₁₂₃₄₅₆₇₈₉
    const subscripts = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
    const subscriptNum = leadingZeros.toString().split('').map(d => subscripts[parseInt(d)]).join('');
    return sign + '0.0' + subscriptNum + significantDigits;
  }

  // Fallback
  return sign + absValue.toExponential(2);
}

/**
 * Format large percentages with compact notation (K, M, B, T, Q)
 * For percentages over 100,000%, use K/M/B notation
 * Always includes sign (+/-) prefix
 * @param value - The percentage value (e.g., 1500000 for 1,500,000%)
 * @returns Formatted string like "+1.5M%" or "-250K%"
 */
export function formatLargePercent(value: number): string {
  const absValue = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';

  // Quadrillions (1e15)
  if (absValue >= 1e15) {
    const q = absValue / 1e15;
    return sign + (q < 10 ? q.toFixed(1) : Math.round(q).toLocaleString()) + 'Q%';
  }

  // Trillions (1e12)
  if (absValue >= 1e12) {
    const t = absValue / 1e12;
    return sign + (t < 10 ? t.toFixed(1) : Math.round(t).toLocaleString()) + 'T%';
  }

  // Billions (1e9)
  if (absValue >= 1e9) {
    const b = absValue / 1e9;
    return sign + (b < 10 ? b.toFixed(1) : Math.round(b).toLocaleString()) + 'B%';
  }

  // Millions (1e6)
  if (absValue >= 1e6) {
    const m = absValue / 1e6;
    return sign + (m < 10 ? m.toFixed(1) : Math.round(m).toLocaleString()) + 'M%';
  }

  // Thousands (100K+)
  if (absValue >= 100000) {
    const k = absValue / 1000;
    return sign + (k < 10 ? k.toFixed(1) : Math.round(k).toLocaleString()) + 'K%';
  }

  // Normal percentages (<100K) - show with 1 decimal
  return sign + absValue.toLocaleString('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  }) + '%';
}

/**
 * Format a number with smart decimal handling:
 * - Removes unnecessary trailing zeros (e.g., 100.00 -> 100, 90.50 -> 90.5)
 * - Shows 0 with no decimals
 * - Preserves significant decimals up to maxDecimals
 */
export function formatSmartNumber(value: number, maxDecimals = 6): string {
  if (value === 0) return '0';

  // Format with max decimals, then trim trailing zeros
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  });

  return formatted;
}

export function formatPriceSigFig(price: number, sigFigs = 3): string {
  if (price === 0) return '$0.00';

  // For numbers >= 1, always show 2 decimal places
  if (price >= 1) {
    return '$' + price.toFixed(2);
  }

  // For small numbers, calculate leading zeros from magnitude
  const leadingZeros = Math.max(0, Math.floor(-Math.log10(price)) - 1);

  // Use scientific notation for very small numbers (7+ leading zeros)
  if (leadingZeros >= 7) {
    return '$' + price.toExponential(sigFigs - 1);
  }

  // Ensure we show at least leading zeros + sigFigs digits after decimal
  const neededDecimals = leadingZeros + 1 + sigFigs;

  // Show all leading zeros plus significant digits
  const totalDecimals = Math.max(neededDecimals, 2);
  return '$' + price.toFixed(totalDecimals);
}

// Known token addresses for price lookups
const WEDAI_ADDRESS = '0xefd766ccb38eaf1dfd701853bfce31359239f305';
export const WPLS_ADDRESS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27';
export const PLS_NATIVE_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // AgoraX native PLS marker
];

/**
 * Get token price from price data with fallbacks for known tokens
 */
export function getTokenPrice(tokenAddress: string, tokenPrices: Record<string, { price: number }>): number {
  const addr = tokenAddress.toLowerCase();

  // Hardcode weDAI to $1.00
  if (addr === WEDAI_ADDRESS) {
    return 1.0;
  }

  // Use WPLS price for native PLS addresses
  if (PLS_NATIVE_ADDRESSES.some(plsAddr => addr === plsAddr.toLowerCase())) {
    const wplsPrice = tokenPrices[WPLS_ADDRESS]?.price;
    return wplsPrice || 0;
  }

  return tokenPrices[tokenAddress]?.price || tokenPrices[addr]?.price || 0;
}

/**
 * Format USD amount with smart handling for very small and very large values
 * - Very small (<$0.01): shows significant figures like $0.0001
 * - Small (<$1): shows cents with appropriate precision
 * - Normal (<$1K): shows $X.XX
 * - Thousands: shows $X.XXK
 * - Millions: shows $X.XXM
 * - Billions: shows $X.XXB
 * - Trillions: shows $X.XXT
 */
export function formatUSD(amount: number): string {
  if (amount === 0) return '$0.00';

  // Handle negative amounts
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const prefix = isNegative ? '-$' : '$';

  // Very small amounts - show significant figures
  if (absAmount > 0 && absAmount < 0.01) {
    // Find first significant digit and show 2-3 sig figs
    const str = absAmount.toString();
    const match = str.match(/0\.0*[1-9]/);
    if (match) {
      const leadingZeros = match[0].length - 2; // subtract "0."
      const decimals = Math.min(leadingZeros + 2, 8);
      return prefix + absAmount.toFixed(decimals);
    }
    return prefix + absAmount.toFixed(4);
  }

  // Small amounts ($0.01 - $0.99)
  if (absAmount < 1) {
    return prefix + absAmount.toFixed(2);
  }

  // Normal amounts ($1 - $999.99)
  if (absAmount < 1000) {
    return prefix + absAmount.toFixed(2);
  }

  // Thousands ($1K - $999.99K)
  if (absAmount < 1000000) {
    const k = absAmount / 1000;
    return prefix + (k < 10 ? k.toFixed(2) : k < 100 ? k.toFixed(1) : k.toFixed(0)) + 'K';
  }

  // Millions ($1M - $999.99M)
  if (absAmount < 1000000000) {
    const m = absAmount / 1000000;
    return prefix + (m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : m.toFixed(0)) + 'M';
  }

  // Billions ($1B - $999.99B)
  if (absAmount < 1000000000000) {
    const b = absAmount / 1000000000;
    return prefix + (b < 10 ? b.toFixed(2) : b < 100 ? b.toFixed(1) : b.toFixed(0)) + 'B';
  }

  // Trillions ($1T+)
  const t = absAmount / 1000000000000;
  return prefix + (t < 10 ? t.toFixed(2) : t < 100 ? t.toFixed(1) : t.toFixed(0)) + 'T';
}

/**
 * Format number with commas (e.g., 1000000 -> "1,000,000")
 */
export function formatNumberWithCommas(value: string): string {
  const parts = value.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

/**
 * Remove commas from formatted number string
 */
export function removeCommas(value: string): string {
  return value.replace(/,/g, '');
}