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
  
  // For small numbers, count leading zeros after decimal point
  const str = price.toString();
  const [, decimal = ''] = str.split('.');
  let leadingZeros = 0;
  for (const char of decimal) {
    if (char === '0') leadingZeros++;
    else break;
  }
  
  // Show all leading zeros plus 3 significant digits
  const totalDecimals = Math.max(leadingZeros + 3, 2);
  return '$' + price.toFixed(totalDecimals);
}